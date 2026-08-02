import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  CaptureRecord,
  HouseMemoryRecord,
  WorkspaceCatalog,
  WorkspaceProjectSummary
} from "../../shared/contracts";

type HearthSearchFilter =
  | "all"
  | "note"
  | "idea"
  | "library"
  | "project"
  | "memory";

export type HearthSearchResult =
  | {
      id: string;
      kind: "note" | "idea" | "library";
      title: string;
      snippet: string;
      context: string;
      capture: CaptureRecord;
      project: null;
      score: number;
    }
  | {
      id: string;
      kind: "project";
      title: string;
      snippet: string;
      context: string;
      capture: null;
      project: WorkspaceProjectSummary;
      score: number;
    }
  | {
      id: string;
      kind: "memory";
      title: string;
      snippet: string;
      context: string;
      capture: null;
      project: null;
      memory: HouseMemoryRecord;
      score: number;
    };

export function HearthSearch({
  captures,
  catalog,
  memories,
  onClose,
  onOpen
}: {
  captures: CaptureRecord[];
  catalog: WorkspaceCatalog | null;
  memories: HouseMemoryRecord[];
  onClose: () => void;
  onOpen: (result: HearthSearchResult) => void;
}): ReactNode {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HearthSearchFilter>("all");
  const [matchedCaptures, setMatchedCaptures] = useState(captures);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || filter === "project" || filter === "memory") {
      setMatchedCaptures(
        filter === "project" || filter === "memory" ? [] : captures
      );
      setSearching(false);
      return;
    }
    let current = true;
    const kind =
      filter === "library"
        ? "link"
        : filter === "note" || filter === "idea"
          ? filter
          : undefined;
    setSearching(true);
    const timeout = window.setTimeout(() => {
      void window.hearth
        .searchCaptures(trimmed, kind, 100)
        .then((items) => {
          if (current) setMatchedCaptures(items);
        })
        .catch(() => {
          if (current) setMatchedCaptures(captures);
        })
        .finally(() => {
          if (current) setSearching(false);
        });
    }, 90);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [captures, filter, query]);

  const results = useMemo(() => {
    const words = query
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{N}_-]+/u)
      .filter(Boolean);
    const scoreText = (fields: Array<[string, number]>): number =>
      words.reduce(
        (total, word) =>
          total +
          Math.max(
            0,
            ...fields.map(([value, weight]) =>
              value.toLocaleLowerCase().includes(word) ? weight : 0
            )
          ),
        0
      );
    const captureResults: HearthSearchResult[] = matchedCaptures
      .filter((item) => {
        if (filter === "note" && item.kind !== "note") return false;
        if (filter === "idea" && item.kind !== "idea") return false;
        if (filter === "library" && item.kind !== "link") return false;
        if (filter === "project" || filter === "memory") return false;
        const searchable = [
          item.title,
          item.libraryCollection,
          item.tags.join(" "),
          item.projectName,
          item.domain,
          item.description,
          item.text
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();
        return words.every((word) => searchable.includes(word));
      })
      .map((item) => {
        const kind = item.kind === "link" ? "library" : item.kind;
        const title =
          item.title ??
          item.domain ??
          (item.text.length > 82
            ? `${item.text.slice(0, 79).trimEnd()}…`
            : item.text);
        const score =
          scoreText([
            [item.title ?? "", 8],
            [item.libraryCollection ?? "", 8],
            [item.tags.join(" "), 7],
            [item.projectName ?? "", 6],
            [item.domain ?? "", 5],
            [item.description ?? "", 4],
            [item.text, 3]
          ]) + (item.pinned ? 1 : 0);
        return {
          id: item.id,
          kind,
          title,
          snippet: item.description ?? item.text,
          context:
            item.kind === "idea"
              ? `${item.ideaState === "let-go" ? "Let go" : item.ideaState === "pursuing" ? "Pursuing" : "Resting"}${item.projectName ? ` · ${item.projectName}` : ""}`
              : `${item.kind === "link" ? item.libraryCollection ? `Library · ${item.libraryCollection}` : "Library · Unfiled" : item.workspaceProjectId ? "Connected note" : "Loose note"}${item.projectName ? ` · ${item.projectName}` : ""}${item.archived ? " · Put away" : ""}`,
          capture: item,
          project: null,
          score
        } satisfies HearthSearchResult;
      });
    const projectResults: HearthSearchResult[] =
      filter === "note" ||
      filter === "idea" ||
      filter === "library" ||
      filter === "memory"
        ? []
        : (catalog?.projects ?? [])
            .filter((project) => {
              const searchable = `${project.name} ${project.rootPath} ${project.signals.join(" ")}`.toLocaleLowerCase();
              return words.every((word) => searchable.includes(word));
            })
            .map((project) => ({
            id: project.id,
            kind: "project",
            title: project.name,
            snippet: project.rootPath,
            context: `Project${project.branch ? ` · ${project.branch}` : ""}`,
            capture: null,
            project,
            score: scoreText([
              [project.name, 8],
              [project.rootPath, 4],
              [project.signals.join(" "), 2]
            ])
          }));
    const memoryResults: HearthSearchResult[] =
      filter === "note" ||
      filter === "idea" ||
      filter === "library" ||
      filter === "project"
        ? []
        : memories
            .filter((memory) => {
              const searchable = [
                memory.text,
                memory.kind,
                memory.scope,
                memory.subjectLabel
              ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase();
              return words.every((word) => searchable.includes(word));
            })
            .map((memory) => ({
              id: memory.id,
              kind: "memory",
              title: memory.text,
              snippet: memory.reason ?? "Approved House Memory",
              context:
                memory.scope === "project"
                  ? `Memory · ${memory.subjectLabel ?? "Project"}`
                  : memory.scope === "resident"
                    ? `Memory · ${memory.subjectLabel ?? "Resident"}`
                    : `Memory · ${memory.kind}`,
              capture: null,
              project: null,
              memory,
              score: scoreText([
                [memory.text, 8],
                [memory.subjectLabel ?? "", 5],
                [memory.kind, 3]
              ])
            }));
    return [...captureResults, ...projectResults, ...memoryResults]
      .filter((item) => !words.length || item.score > 0)
      .sort((left, right) =>
        right.score !== left.score
          ? right.score - left.score
          : left.title.localeCompare(right.title)
      )
      .slice(0, 60);
  }, [matchedCaptures, catalog, filter, memories, query]);

  return (
    <div
      className="hearth-search-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="hearth-search"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hearth-search-title"
      >
        <header>
          <div>
            <p className="eyebrow">Find anything</p>
            <h2 id="hearth-search-title">Search the house</h2>
          </div>
          <button type="button" aria-label="Close search" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="hearth-search-input">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            aria-label="Search the house"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A phrase, tag, project, link, or half-remembered thought…"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="hearth-search-filters" role="tablist" aria-label="Search type">
          {([
            ["all", "Everything"],
            ["note", "Notes"],
            ["idea", "Ideas"],
            ["library", "Library"],
            ["project", "Projects"],
            ["memory", "Memory"]
          ] as const).map(([value, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? "is-active" : ""}
              onClick={() => setFilter(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="hearth-search-results" aria-live="polite">
          {results.length ? (
            results.map((result) => (
              <button
                className={`hearth-search-result hearth-search-result--${result.kind}`}
                type="button"
                onClick={() => onOpen(result)}
                key={`${result.kind}-${result.id}`}
              >
                <span className="hearth-search-glyph" aria-hidden="true">
                  {result.kind === "note"
                    ? "N"
                    : result.kind === "idea"
                      ? "✦"
                      : result.kind === "library"
                        ? "L"
                        : result.kind === "memory"
                          ? "M"
                          : "P"}
                </span>
                <span>
                  <small>{result.context}</small>
                  <strong>{result.title}</strong>
                  <p>{result.snippet}</p>
                </span>
                <i aria-hidden="true">→</i>
              </button>
            ))
          ) : (
            <div className="hearth-search-empty">
              <strong>Nothing matches that yet.</strong>
              <p>Try fewer words, another filter, or ask Librarian naturally.</p>
            </div>
          )}
        </div>
        <footer>
          <span>Organization helps, but it never gates retrieval.</span>
          <small>
            {searching
              ? "Looking through the house…"
              : `${results.length} ${results.length === 1 ? "result" : "results"}`}
          </small>
        </footer>
      </section>
    </div>
  );
}
