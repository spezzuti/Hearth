import type { LibraryReference, ReferenceKind } from "../shared/contracts";

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref_src",
  "source"
]);

function cleanRepository(value: string): string {
  return value.replace(/\.git$/i, "");
}

function referenceKind(parts: string[]): {
  kind: ReferenceKind;
  identifier: string | null;
  canonicalParts: string[];
} | null {
  if (parts[2] === "pull" && /^\d+$/.test(parts[3] ?? "")) {
    return { kind: "pull-request", identifier: parts[3]!, canonicalParts: parts.slice(0, 4) };
  }
  if (parts[2] === "issues" && /^\d+$/.test(parts[3] ?? "")) {
    return { kind: "issue", identifier: parts[3]!, canonicalParts: parts.slice(0, 4) };
  }
  if (parts[2] === "releases" && parts[3] === "tag" && parts[4]) {
    return {
      kind: "release",
      identifier: decodeURIComponent(parts.slice(4).join("/")),
      canonicalParts: parts
    };
  }
  if (parts[2] === "commit" && parts[3]) {
    return { kind: "commit", identifier: parts[3], canonicalParts: parts.slice(0, 4) };
  }
  if (parts.length === 2) {
    return { kind: "repository", identifier: null, canonicalParts: parts };
  }
  return null;
}

function webReference(url: URL): LibraryReference {
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return {
    id: `web:${url.toString()}`,
    kind: "web",
    canonicalUrl: url.toString(),
    host: url.hostname.replace(/^www\./i, ""),
    owner: null,
    repository: null,
    identifier: null,
    title: null,
    description: null,
    metadataState: "unverified",
    stars: null,
    language: null,
    topics: [],
    sourceUpdatedAt: null,
    retrievedAt: null
  };
}

export function recognizeReference(value: string): LibraryReference | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    return null;
  }
  url.hash = "";
  url.hostname = url.hostname.toLocaleLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLocaleLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(key.toLocaleLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  let parts: string[];
  try {
    parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
  const github = url.hostname === "github.com" && parts.length >= 2;
  if (!github) {
    return webReference(url);
  }

  const owner = parts[0]!;
  const repository = cleanRepository(parts[1]!);
  parts[1] = repository;
  const recognized = referenceKind(parts);
  if (!recognized) return webReference(url);
  url.protocol = "https:";
  url.search = "";
  url.pathname = `/${recognized.canonicalParts.map(encodeURIComponent).join("/")}`;
  const identifier = recognized.identifier;
  return {
    id: ["github", owner, repository, recognized.kind, identifier].filter(Boolean).join(":"),
    kind: recognized.kind,
    canonicalUrl: url.toString(),
    host: "github.com",
    owner,
    repository,
    identifier,
    title: null,
    description: null,
    metadataState: "unverified",
    stars: null,
    language: null,
    topics: [],
    sourceUpdatedAt: null,
    retrievedAt: null
  };
}

export function referenceLabel(reference: LibraryReference): string {
  if (!reference.repository || !reference.owner) return reference.host;
  const repository = `${reference.owner}/${reference.repository}`;
  if (reference.kind === "pull-request") return `${repository} pull request #${reference.identifier}`;
  if (reference.kind === "issue") return `${repository} issue #${reference.identifier}`;
  if (reference.kind === "release") return `${repository} release ${reference.identifier}`;
  if (reference.kind === "commit") return `${repository} commit ${reference.identifier?.slice(0, 8)}`;
  return repository;
}

export function withReferenceMetadata(
  reference: LibraryReference,
  metadata: { title: string | null; description: string | null },
  retrievedAt: string
): LibraryReference {
  return {
    ...reference,
    title: metadata.title,
    description: metadata.description,
    metadataState: "retrieved",
    retrievedAt
  };
}
