import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  ArchiveItem,
  ArchiveKind,
  ArchiveRemovalResult,
  ArchiveSnapshot,
  CapturePatch,
  ReturnPack,
  Room,
  WorkspaceProjectSummary
} from "../../shared/contracts";
import { ReferenceCard } from "./ReferenceCard";

const FILTERS: Array<{
  kind: ArchiveKind | "all";
  label: string;
  shortLabel: string;
}> = [
  { kind: "all", label: "Everything", shortLabel: "All" },
  { kind: "return-pack", label: "Return Packs", shortLabel: "Returns" },
  { kind: "library", label: "Library", shortLabel: "Library" },
  { kind: "idea", label: "Let-go ideas", shortLabel: "Ideas" },
  { kind: "handoff", label: "Handoffs", shortLabel: "Handoffs" },
  { kind: "edit", label: "File recovery", shortLabel: "Edits" }
];

const KIND_META: Record<
  ArchiveKind,
  { label: string; symbol: string; tone: string }
> = {
  "return-pack": { label: "Return Pack", symbol: "R", tone: "green" },
  library: { label: "Library", symbol: "L", tone: "gold" },
  idea: { label: "Idea", symbol: "✦", tone: "copper" },
  handoff: { label: "Handoff", symbol: "W", tone: "blue" },
  edit: { label: "File recovery", symbol: "↶", tone: "slate" }
};

function formatArchiveDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function searchableText(item: ArchiveItem): string {
  return [
    item.title,
    item.summary,
    item.status,
    item.projectName,
    item.path,
    ...item.details.flatMap((detail) => [detail.label, detail.value])
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function archiveCopy(item: ArchiveItem): string {
  const heading = `${KIND_META[item.kind].label} · ${item.status}`;
  const context = [item.projectName, item.path].filter(Boolean).join(" · ");
  return [
    heading,
    item.title,
    context,
    item.summary,
    "",
    ...item.details.map((detail) => `${detail.label}\n${detail.value}`)
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n");
}

export function ArchiveRoom({
  onUpdateCapture,
  onRemoveArchiveItem,
  onNavigate,
  onNotify,
  currentProject,
  terminalLive,
  onOpenReturnPack,
  onOrientProject
}: {
  onUpdateCapture: (captureId: string, patch: CapturePatch) => Promise<void>;
  onRemoveArchiveItem: (
    archiveId: string,
    kind: ArchiveKind
  ) => Promise<ArchiveRemovalResult>;
  onNavigate: (route: Room) => void;
  onNotify: (message: string) => void;
  currentProject: WorkspaceProjectSummary;
  terminalLive: boolean;
  onOpenReturnPack: (pack: ReturnPack) => Promise<void>;
  onOrientProject: (
    projectId: string,
    path: string | null,
    destination: "project" | "workshop"
  ) => Promise<void>;
}): ReactNode {
  const [archive, setArchive] = useState<ArchiveSnapshot | null>(null);
  const [filter, setFilter] = useState<ArchiveKind | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pendingOrientation, setPendingOrientation] = useState<{
    item: ArchiveItem;
    destination: "project" | "workshop";
  } | null>(null);
  const [orientationBusy, setOrientationBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadArchive(preferredId?: string): Promise<void> {
    try {
      const snapshot = await window.hearth.getArchive();
      setArchive(snapshot);
      setError(null);
      setSelectedId((current) => {
        const candidate = preferredId ?? current;
        if (candidate && snapshot.items.some((item) => item.id === candidate)) {
          return candidate;
        }
        return snapshot.items[0]?.id ?? null;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Archive could not be opened.");
    }
  }

  useEffect(() => {
    void loadArchive();
  }, []);

  const visibleItems = useMemo(() => {
    if (!archive) return [];
    const normalized = query.trim().toLocaleLowerCase();
    return archive.items.filter(
      (item) =>
        (filter === "all" || item.kind === filter) &&
        (!normalized || searchableText(item).includes(normalized))
    );
  }, [archive, filter, query]);

  useEffect(() => {
    if (
      selectedId &&
      visibleItems.some((item) => item.id === selectedId)
    ) {
      return;
    }
    setSelectedId(visibleItems[0]?.id ?? null);
  }, [selectedId, visibleItems]);

  const selected =
    visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null;

  useEffect(() => {
    setConfirmUndo(false);
    setConfirmRemove(false);
    setPendingOrientation(null);
  }, [selected?.id]);

  async function restore(item: ArchiveItem): Promise<void> {
    if (!item.action || busyId) return;
    setBusyId(item.id);
    try {
      if (item.action === "restore-library") {
        await onUpdateCapture(item.id, { archived: false });
        await loadArchive();
        onNotify("Back on the active Library shelf.");
        return;
      }
      if (item.action === "restore-idea") {
        await onUpdateCapture(item.id, { ideaState: "resting", archived: false });
        await loadArchive();
        onNotify("That idea is resting in Studio again.");
        return;
      }
      const result = await window.hearth.restoreProjectEdit(item.id);
      await loadArchive(item.id);
      setConfirmUndo(false);
      onNotify(`${result.record.projectName} · ${result.record.path} restored from backup.`);
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "That Archive action could not be completed."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function copyItem(item: ArchiveItem): Promise<void> {
    try {
      await window.hearth.writeClipboard(archiveCopy(item));
      onNotify("Archive record copied.");
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : "That record could not be copied.");
    }
  }

  async function removeForever(item: ArchiveItem): Promise<void> {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const result = await onRemoveArchiveItem(item.id, item.kind);
      await loadArchive();
      setConfirmRemove(false);
      onNotify(
        result.removedFile
          ? "Archive record and private backup removed permanently."
          : "Archive record removed permanently."
      );
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "That Archive record could not be removed."
      );
    } finally {
      setBusyId(null);
    }
  }

  function actionLabel(item: ArchiveItem): string {
    if (busyId === item.id) return "Working…";
    if (item.action === "restore-library") return "Return to Library";
    if (item.action === "restore-idea") return "Return to Studio";
    return "Undo Hearth edit";
  }

  async function orientProject(
    item: ArchiveItem,
    destination: "project" | "workshop"
  ): Promise<void> {
    if (!item.projectId || orientationBusy) return;
    if (item.projectId !== currentProject.id && !pendingOrientation) {
      setPendingOrientation({ item, destination });
      return;
    }
    setOrientationBusy(true);
    try {
      await onOrientProject(item.projectId, item.path, destination);
    } finally {
      setOrientationBusy(false);
      setPendingOrientation(null);
    }
  }

  return (
    <main className="room-content archive-room">
      <header className="archive-heading">
        <div>
          <p className="eyebrow">Archive</p>
          <h1>Finished doesn’t mean gone.</h1>
          <p>
            Return Packs, things you put away, decisions you closed, and work Hearth
            can safely recover.
          </p>
        </div>
        <div className="archive-cabinet" aria-hidden="true">
          <span />
          <span />
          <i />
        </div>
      </header>

      <section className="archive-toolbar" aria-label="Archive search and filters">
        <label className="archive-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search Archive"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search decisions, projects, files, or old context"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")}>
              Clear
            </button>
          ) : null}
        </label>
        <div className="archive-filters" role="group" aria-label="Archive kind">
          {FILTERS.map((item) => {
            const count =
              item.kind === "all"
                ? archive?.items.length ?? 0
                : archive?.counts[item.kind] ?? 0;
            return (
              <button
                type="button"
                key={item.kind}
                className={filter === item.kind ? "is-active" : ""}
                onClick={() => setFilter(item.kind)}
                title={item.label}
              >
                <span className="archive-filter-long">{item.label}</span>
                <span className="archive-filter-short">{item.shortLabel}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="archive-workspace">
        <div className="archive-list" aria-label="Archive records">
          <div className="archive-list-heading">
            <strong>
              {query || filter !== "all"
                ? `${visibleItems.length} matching`
                : `${visibleItems.length} kept records`}
            </strong>
            <small>Newest first</small>
          </div>
          {error ? (
            <div className="archive-empty">
              <strong>Archive stayed closed.</strong>
              <p>{error}</p>
              <button type="button" className="small-button" onClick={() => void loadArchive()}>
                Try again
              </button>
            </div>
          ) : !archive ? (
            <div className="archive-empty">
              <strong>Opening the cabinets…</strong>
              <p>Hearth is gathering recovery records without changing anything.</p>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="archive-empty">
              <strong>Nothing is tucked away here.</strong>
              <p>
                {query
                  ? "Try a project name, file, decision, or a broader phrase."
                  : "This section will fill naturally as you finish and put things away."}
              </p>
            </div>
          ) : (
            visibleItems.map((item) => {
              const meta = KIND_META[item.kind];
              return (
                <button
                  type="button"
                  className={`archive-record ${
                    selected?.id === item.id ? "is-selected" : ""
                  }`}
                  key={`${item.kind}-${item.id}`}
                  onClick={() => setSelectedId(item.id)}
                  aria-pressed={selected?.id === item.id}
                >
                  <span className={`archive-record-icon archive-record-icon--${meta.tone}`}>
                    {meta.symbol}
                  </span>
                  <span className="archive-record-copy">
                    <span>
                      <strong>{item.title}</strong>
                      <time>{formatArchiveDate(item.createdAt)}</time>
                    </span>
                    <p>{item.summary}</p>
                    <small>
                      {meta.label} · {item.status}
                      {item.projectName ? ` · ${item.projectName}` : ""}
                    </small>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <aside className="archive-detail" aria-label="Archive record detail">
          {selected ? (
            <>
              <div className="archive-detail-heading">
                <span
                  className={`archive-record-icon archive-record-icon--${
                    KIND_META[selected.kind].tone
                  }`}
                  aria-hidden="true"
                >
                  {KIND_META[selected.kind].symbol}
                </span>
                <div>
                  <p className="eyebrow">{KIND_META[selected.kind].label}</p>
                  <strong>{selected.status}</strong>
                </div>
                <time>{formatArchiveDate(selected.createdAt)}</time>
              </div>
              <div className="archive-detail-body">
                <h2>{selected.title}</h2>
                <p className="archive-detail-summary">{selected.summary}</p>
                {selected.reference ? (
                  <ReferenceCard
                    reference={selected.reference}
                    onOpen={() => void window.hearth.openExternal(selected.reference!.canonicalUrl)}
                  />
                ) : null}
                {selected.projectName || selected.path ? (
                  <div className="archive-context">
                    {selected.projectName ? <strong>{selected.projectName}</strong> : null}
                    {selected.path ? <code>{selected.path}</code> : null}
                  </div>
                ) : null}
                <dl>
                  {selected.details.map((detail, index) => (
                    <div key={`${detail.label}-${index}`}>
                      <dt>{detail.label}</dt>
                      <dd>{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="archive-detail-actions">
                {confirmRemove ? (
                  <div className="archive-remove-confirm">
                    <strong>
                      {selected.removal.removesFile
                        ? "This permanently deletes a backup file."
                        : "Remove this record forever?"}
                    </strong>
                    <p>{selected.removal.consequence}</p>
                    <p>This cannot be undone.</p>
                    <div>
                      <button
                        type="button"
                        className="small-button small-button--quiet"
                        onClick={() => setConfirmRemove(false)}
                      >
                        Keep it
                      </button>
                      <button
                        type="button"
                        className="small-button archive-danger-button"
                        disabled={Boolean(busyId)}
                        onClick={() => void removeForever(selected)}
                      >
                        {busyId === selected.id
                          ? "Removingâ€¦"
                          : "Yes, remove forever"}
                      </button>
                    </div>
                  </div>
                ) : selected.action === "undo-edit" && confirmUndo ? (
                  <div className="archive-undo-confirm">
                    <p>
                      Hearth will restore its private backup only if this file still
                      exactly matches the version Hearth applied.
                    </p>
                    <div>
                      <button
                        type="button"
                        className="small-button small-button--quiet"
                        onClick={() => setConfirmUndo(false)}
                      >
                        Keep it
                      </button>
                      <button
                        type="button"
                        className="small-button archive-danger-button"
                        disabled={Boolean(busyId)}
                        onClick={() => void restore(selected)}
                      >
                        {busyId === selected.id ? "Checking…" : "Restore backup"}
                      </button>
                    </div>
                  </div>
                ) : pendingOrientation?.item.id === selected.id ? (
                  <div className="archive-orient-confirm">
                    <strong>Make {selected.projectName ?? "this project"} current?</strong>
                    <p>
                      Hearth will switch the working project from {currentProject.name}.
                      {terminalLive
                        ? " The live terminal will stay exactly where it is."
                        : " No terminal or resident will be started."}
                    </p>
                    <div>
                      <button
                        type="button"
                        className="small-button small-button--quiet"
                        onClick={() => setPendingOrientation(null)}
                      >
                        Stay here
                      </button>
                      <button
                        type="button"
                        className="small-button"
                        disabled={orientationBusy}
                        onClick={() =>
                          void orientProject(
                            pendingOrientation.item,
                            pendingOrientation.destination
                          )
                        }
                      >
                        {orientationBusy
                          ? "Opening…"
                          : pendingOrientation.destination === "project"
                            ? selected.path
                              ? "Make current & open file"
                              : "Make current & open project"
                            : "Make current & open Workshop"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="small-button small-button--quiet"
                      onClick={() => void copyItem(selected)}
                    >
                      Copy record
                    </button>
                    {selected.action ? (
                      <button
                        type="button"
                        className="small-button"
                        disabled={Boolean(busyId)}
                        onClick={() =>
                          selected.action === "undo-edit"
                            ? setConfirmUndo(true)
                            : void restore(selected)
                        }
                      >
                        {actionLabel(selected)}
                      </button>
                    ) : null}
                    {selected.returnPack ? (
                      <button
                        type="button"
                        className="archive-room-link"
                        onClick={() => void onOpenReturnPack(selected.returnPack!)}
                      >
                        View on Home
                      </button>
                    ) : null}
                    {selected.projectId ? (
                      <button
                        type="button"
                        className="archive-room-link"
                        disabled={orientationBusy}
                        onClick={() => void orientProject(selected, "project")}
                      >
                        {selected.path ? "Open exact file" : "Open project"}
                      </button>
                    ) : null}
                    {selected.kind === "handoff" ? (
                      selected.projectId ? (
                        <button
                          type="button"
                          className="archive-room-link"
                          disabled={orientationBusy}
                          onClick={() => void orientProject(selected, "workshop")}
                        >
                          Work in Workshop
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="archive-room-link"
                          onClick={() => onNavigate("workshop")}
                        >
                          Open Workshop
                        </button>
                      )
                    ) : null}
                    <button
                      type="button"
                      className="archive-room-link archive-remove-link"
                      onClick={() => setConfirmRemove(true)}
                    >
                      Remove forever
                    </button>
                  </>
                )}
                {!confirmRemove &&
                !confirmUndo &&
                !pendingOrientation &&
                selected.action === "restore-library" ? (
                  <button
                    type="button"
                    className="archive-room-link"
                    onClick={() => onNavigate("library")}
                  >
                    Open Library
                  </button>
                ) : !confirmRemove &&
                  !confirmUndo &&
                  !pendingOrientation &&
                  selected.action === "restore-idea" ? (
                  <button
                    type="button"
                    className="archive-room-link"
                    onClick={() => onNavigate("studio")}
                  >
                    Open Studio
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="archive-empty archive-empty--detail">
              <strong>Pick a record.</strong>
              <p>The detail stays quiet until there is something useful to show.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
