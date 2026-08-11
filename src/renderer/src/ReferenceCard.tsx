import type { LibraryReference } from "../../shared/contracts";

const KIND_LABELS: Record<LibraryReference["kind"], string> = {
  web: "Web reference",
  repository: "Repository",
  "pull-request": "Pull request",
  issue: "Issue",
  release: "Release",
  commit: "Commit"
};

function referenceName(reference: LibraryReference): string {
  if (!reference.owner || !reference.repository) return reference.host;
  const repository = `${reference.owner}/${reference.repository}`;
  if (reference.kind === "pull-request") return `${repository} · #${reference.identifier}`;
  if (reference.kind === "issue") return `${repository} · #${reference.identifier}`;
  if (reference.kind === "release") return `${repository} · ${reference.identifier}`;
  if (reference.kind === "commit") return `${repository} · ${reference.identifier?.slice(0, 8)}`;
  return repository;
}

export function ReferenceCard({
  reference,
  compact = false,
  onOpen
}: {
  reference: LibraryReference;
  compact?: boolean;
  onOpen?: () => void;
}) {
  return (
    <section className={`reference-card${compact ? " reference-card--compact" : ""}`}>
      <header>
        <span>{KIND_LABELS[reference.kind]}</span>
        <small className={`reference-state reference-state--${reference.metadataState}`}>
          {reference.metadataState === "retrieved"
            ? "Public details retrieved"
            : reference.metadataState === "failed"
              ? "Details unavailable"
              : "Saved URL · unverified details"}
        </small>
      </header>
      <strong>{referenceName(reference)}</strong>
      {!compact && (reference.title || reference.description) ? (
        <p>{reference.title ?? reference.description}</p>
      ) : null}
      <footer>
        <span title={reference.canonicalUrl}>{reference.canonicalUrl}</span>
        {onOpen ? <button type="button" onClick={onOpen}>Open ↗</button> : null}
      </footer>
    </section>
  );
}
