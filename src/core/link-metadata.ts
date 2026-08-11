import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { LibraryReference } from "../shared/contracts";
import { recognizeReference, withReferenceMetadata } from "./references";

const MAX_HTML_BYTES = 384 * 1024;
const MAX_JSON_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first === 224 ||
    first === 255
  );
}

export function isPublicAddress(address: string): boolean {
  const normalized = address.toLocaleLowerCase().split("%")[0] ?? "";
  const version = isIP(normalized);
  if (version === 4) return !isPrivateIpv4(normalized);
  if (version !== 6) return false;
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  ) {
    return false;
  }
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped?.[1] ? !isPrivateIpv4(mapped[1]) : true;
}

async function assertPublicUrl(candidate: string): Promise<URL> {
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Hearth only reads details from HTTP or HTTPS links.");
  }
  if (
    !url.hostname ||
    url.username ||
    url.password ||
    url.hostname.toLocaleLowerCase() === "localhost" ||
    url.hostname.toLocaleLowerCase().endsWith(".local")
  ) {
    throw new Error("Hearth will not request details from a private address.");
  }
  if (isIP(url.hostname)) {
    if (!isPublicAddress(url.hostname)) {
      throw new Error("Hearth will not request details from a private address.");
    }
    return url;
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) {
    throw new Error("Hearth will not request details from a private address.");
  }
  return url;
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) => named[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const first = new RegExp(
    `<meta[^>]+(?:name|property)\\s*=\\s*["']${escaped}["'][^>]+content\\s*=\\s*["']([^"']*)["'][^>]*>`,
    "i"
  ).exec(html)?.[1];
  const second = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*>`,
    "i"
  ).exec(html)?.[1];
  return first ?? second ?? null;
}

export function parseLinkMetadata(html: string): {
  title: string | null;
  description: string | null;
} {
  const rawTitle =
    metaContent(html, "og:title") ??
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ??
    null;
  const rawDescription =
    metaContent(html, "og:description") ??
    metaContent(html, "description") ??
    null;
  const title = rawTitle ? decodeHtml(rawTitle).slice(0, 300) || null : null;
  const description = rawDescription
    ? decodeHtml(rawDescription).slice(0, 2_000) || null
    : null;
  return { title, description };
}

async function requestHtml(candidate: string, redirects = 0): Promise<string> {
  const url = await assertPublicUrl(candidate);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Hearth-Library/0.11"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || redirects >= MAX_REDIRECTS) {
      throw new Error("That link redirected too many times.");
    }
    return requestHtml(new URL(location, url).toString(), redirects + 1);
  }
  if (!response.ok) {
    throw new Error(`That page returned ${response.status} instead of link details.`);
  }
  const contentType = response.headers.get("content-type")?.toLocaleLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("That link does not point to an HTML page.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > MAX_HTML_BYTES) {
      await reader.cancel();
      break;
    }
    html += decoder.decode(chunk.value, { stream: true });
  }
  return html;
}

async function requestJson(candidate: string): Promise<Record<string, unknown>> {
  const url = await assertPublicUrl(candidate);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "error",
      signal: controller.signal,
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "Hearth-Library/0.51"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} instead of public reference details.`);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_JSON_BYTES) {
    throw new Error("That public reference returned more metadata than Hearth will retain.");
  }
  if (!response.body) return {};
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new Error("That public reference returned more metadata than Hearth will retain.");
    }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  raw += decoder.decode();
  return JSON.parse(raw) as Record<string, unknown>;
}

function text(value: unknown, limit: number): string | null {
  return typeof value === "string" ? value.trim().slice(0, limit) || null : null;
}

function githubEndpoint(reference: LibraryReference): string | null {
  if (!reference.owner || !reference.repository) return null;
  const root = `https://api.github.com/repos/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repository)}`;
  if (reference.kind === "repository") return root;
  if (reference.kind === "pull-request") return `${root}/pulls/${reference.identifier}`;
  if (reference.kind === "issue") return `${root}/issues/${reference.identifier}`;
  if (reference.kind === "release") return `${root}/releases/tags/${encodeURIComponent(reference.identifier ?? "")}`;
  if (reference.kind === "commit") return `${root}/commits/${encodeURIComponent(reference.identifier ?? "")}`;
  return null;
}

async function enrichGithubReference(reference: LibraryReference): Promise<{
  title: string | null;
  description: string | null;
  reference: LibraryReference;
}> {
  const endpoint = githubEndpoint(reference);
  if (!endpoint) {
    throw new Error("That GitHub reference does not have a bounded public metadata route.");
  }
  const payload = await requestJson(endpoint);
  const commit = payload.commit && typeof payload.commit === "object"
    ? payload.commit as Record<string, unknown>
    : null;
  const title =
    text(payload.full_name, 300) ??
    text(payload.title, 300) ??
    text(payload.name, 300) ??
    text(payload.tag_name, 300) ??
    text(commit?.message, 300)?.split(/\r?\n/)[0] ??
    null;
  const description =
    text(payload.description, 2_000) ??
    text(payload.body, 2_000) ??
    text(commit?.message, 2_000) ??
    null;
  const topics = Array.isArray(payload.topics)
    ? payload.topics.filter((item): item is string => typeof item === "string").slice(0, 12)
    : [];
  const retrievedAt = new Date().toISOString();
  return {
    title,
    description,
    reference: {
      ...withReferenceMetadata(reference, { title, description }, retrievedAt),
      stars: typeof payload.stargazers_count === "number" ? payload.stargazers_count : null,
      language: text(payload.language, 80),
      topics,
      sourceUpdatedAt:
        text(payload.updated_at, 80) ??
        text(payload.published_at, 80) ??
        null
    }
  };
}

export async function enrichLink(url: string): Promise<{
  title: string | null;
  description: string | null;
  reference: LibraryReference | null;
}> {
  const recognized = recognizeReference(url);
  if (recognized?.host === "github.com" && recognized.kind !== "web") {
    return enrichGithubReference(recognized);
  }
  const metadata = parseLinkMetadata(
    await requestHtml(recognized?.canonicalUrl ?? url)
  );
  return {
    ...metadata,
    reference: recognized
      ? withReferenceMetadata(recognized, metadata, new Date().toISOString())
      : null
  };
}
