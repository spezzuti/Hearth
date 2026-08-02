import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const MAX_HTML_BYTES = 384 * 1024;
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

export async function enrichLink(url: string): Promise<{
  title: string | null;
  description: string | null;
}> {
  return parseLinkMetadata(await requestHtml(url));
}
