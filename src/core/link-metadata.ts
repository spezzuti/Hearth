import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
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
    (first === 100 && second !== undefined && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && second !== undefined && second >= 18 && second <= 19) ||
    (first !== undefined && first >= 224 && first <= 239) ||
    (first !== undefined && first >= 240 && first <= 255) ||
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
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  ) {
    return false;
  }
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped?.[1] ? !isPrivateIpv4(mapped[1]) : true;
}

async function resolvePublicUrl(candidate: string): Promise<{
  url: URL;
  address: { address: string; family: 4 | 6 };
}> {
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
    return {
      url,
      address: { address: url.hostname, family: isIP(url.hostname) as 4 | 6 }
    };
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) {
    throw new Error("Hearth will not request details from a private address.");
  }
  const selected = addresses[0]!;
  return {
    url,
    address: { address: selected.address, family: selected.family as 4 | 6 }
  };
}

interface BoundedResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

async function requestPublic(
  candidate: string,
  accept: string,
  maxBytes: number
): Promise<{ url: URL; response: BoundedResponse }> {
  const { url, address } = await resolvePublicUrl(candidate);
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [address]);
      return;
    }
    callback(null, address.address, address.family);
  };
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  const response = await new Promise<BoundedResponse>((resolve, reject) => {
    const outgoing = request(
      url,
      {
        method: "GET",
        headers: {
          accept,
          "user-agent": "Hearth-Library/0.60"
        },
        lookup: pinnedLookup
      },
      (incoming) => {
        const declaredLength = Number(incoming.headers["content-length"] ?? 0);
        if (declaredLength > maxBytes) {
          incoming.destroy();
          reject(new Error("That public reference returned more metadata than Hearth will retain."));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        incoming.on("data", (chunk: Buffer) => {
          bytes += chunk.byteLength;
          if (bytes > maxBytes) {
            incoming.destroy(
              new Error("That public reference returned more metadata than Hearth will retain.")
            );
            return;
          }
          chunks.push(chunk);
        });
        incoming.on("end", () => {
          resolve({
            status: incoming.statusCode ?? 0,
            headers: incoming.headers,
            body: Buffer.concat(chunks)
          });
        });
        incoming.on("error", reject);
      }
    );
    outgoing.setTimeout(6_000, () => {
      outgoing.destroy(new Error("That public reference took too long to respond."));
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
  return { url, response };
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
  const { url, response } = await requestPublic(
    candidate,
    "text/html,application/xhtml+xml",
    MAX_HTML_BYTES
  );
  if (response.status >= 300 && response.status < 400) {
    const location = Array.isArray(response.headers.location)
      ? response.headers.location[0]
      : response.headers.location;
    if (!location || redirects >= MAX_REDIRECTS) {
      throw new Error("That link redirected too many times.");
    }
    return requestHtml(new URL(location, url).toString(), redirects + 1);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`That page returned ${response.status} instead of link details.`);
  }
  const contentType = String(response.headers["content-type"] ?? "").toLocaleLowerCase();
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("That link does not point to an HTML page.");
  }
  return response.body.toString("utf8");
}

async function requestJson(candidate: string): Promise<Record<string, unknown>> {
  const { response } = await requestPublic(
    candidate,
    "application/vnd.github+json",
    MAX_JSON_BYTES
  );
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`GitHub returned ${response.status} instead of public reference details.`);
  }
  return JSON.parse(response.body.toString("utf8")) as Record<string, unknown>;
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
