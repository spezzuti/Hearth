import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import type {
  AgentContextKind,
  CapturePatch,
  CaptureRecord,
  ContextAgent,
  ProjectDiff,
  ProjectDirectory,
  ProjectEditDraft,
  ProjectEditRecord,
  ProjectFilePreview,
  ProjectSearchResult,
  WorkspaceCatalog,
  WorkspaceProjectDetail,
  WorkspaceProjectSummary
} from "../../shared/contracts";
import { ReferenceCard } from "./ReferenceCard";

function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileGlyph(name: string): string {
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(extension ?? "")) return "JS";
  if (["md", "mdx"].includes(extension ?? "")) return "M";
  if (["json", "jsonc", "yaml", "yml", "toml"].includes(extension ?? "")) return "{}";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(extension ?? "")) return "◫";
  return "·";
}

function DiffView({ diff }: { diff: ProjectDiff }): ReactNode {
  if (!diff.text) {
    return (
      <div className="project-empty">
        <span>✓</span>
        <h3>No text diff to show</h3>
        <p>
          This project may be clean, or the selected item may be untracked. You can still
          preview untracked text files from Files.
        </p>
      </div>
    );
  }
  const allLines = diff.text.split(/\r?\n/);
  const lines = allLines.slice(0, 3_000);
  return (
    <div className="diff-view">
      {lines.map((line, index) => (
        <div
          className={classNames(
            "diff-line",
            line.startsWith("+") && !line.startsWith("+++") && "diff-line--added",
            line.startsWith("-") && !line.startsWith("---") && "diff-line--removed",
            line.startsWith("@@") && "diff-line--hunk",
            /^(diff --git|STAGED CHANGES|WORKING CHANGES)/.test(line) &&
              "diff-line--heading"
          )}
          key={`${index}-${line.slice(0, 20)}`}
        >
          <span>{index + 1}</span>
          <code>{line || " "}</code>
        </div>
      ))}
      {allLines.length > lines.length ? (
        <p className="preview-limit">
          Showing the first {lines.length.toLocaleString()} lines in this review.
        </p>
      ) : null}
    </div>
  );
}

function FileView({ preview }: { preview: ProjectFilePreview }): ReactNode {
  const allLines = preview.text.split(/\r?\n/);
  const lines = allLines.slice(0, 3_000);
  return (
    <div
      className={classNames(
        "file-view",
        ["markdown", "text"].includes(preview.language) && "file-view--prose"
      )}
    >
      {lines.map((line, index) => (
        <div className="file-line" key={`${index}-${line.slice(0, 16)}`}>
          <span>{index + 1}</span>
          <code>{line || " "}</code>
        </div>
      ))}
      {preview.truncated || allLines.length > lines.length ? (
        <p className="preview-limit">
          This preview is intentionally bounded. Open the project in Workshop for the
          complete file.
        </p>
      ) : null}
    </div>
  );
}

function ProjectEditDiff({ draft }: { draft: ProjectEditDraft }): ReactNode {
  return (
    <div className="project-edit-diff">
      {draft.lines.map((line, index) => (
        <div
          className={`project-edit-line project-edit-line--${line.kind}`}
          key={`${index}-${line.kind}-${line.text.slice(0, 20)}`}
        >
          <span>{line.oldLine ?? ""}</span>
          <span>{line.newLine ?? ""}</span>
          <i aria-hidden="true">
            {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}
          </i>
          <code>{line.text || " "}</code>
        </div>
      ))}
    </div>
  );
}

export function ProjectSurface({
  currentProject,
  terminalLive,
  onWorkHere,
  onShareContext,
  onOpenMaker,
  notes,
  onCaptureNote,
  onUpdateNote,
  onOpenNote,
  onNotify,
  orientation
}: {
  currentProject: WorkspaceProjectSummary;
  terminalLive: boolean;
  onWorkHere: (project: WorkspaceProjectSummary) => Promise<void>;
  onShareContext: (
    agent: ContextAgent,
    project: WorkspaceProjectSummary,
    kind: AgentContextKind,
    path?: string,
    paths?: string[]
  ) => Promise<void>;
  onOpenMaker: () => void;
  notes: CaptureRecord[];
  onCaptureNote: (text: string) => Promise<unknown>;
  onUpdateNote: (captureId: string, patch: CapturePatch) => Promise<void>;
  onOpenNote: (captureId: string) => void;
  onNotify: (message: string) => void;
  orientation: {
    requestId: string;
    projectId: string;
    path: string | null;
  } | null;
}): ReactNode {
  const [catalog, setCatalog] = useState<WorkspaceCatalog | null>(null);
  const [selectedId, setSelectedId] = useState(currentProject.id);
  const [detail, setDetail] = useState<WorkspaceProjectDetail | null>(null);
  const [directory, setDirectory] = useState<ProjectDirectory | null>(null);
  const [preview, setPreview] = useState<ProjectFilePreview | null>(null);
  const [diff, setDiff] = useState<ProjectDiff | null>(null);
  const [mode, setMode] = useState<"files" | "changes" | "notes">("files");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteBusyId, setNoteBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentEdits, setRecentEdits] = useState<ProjectEditRecord[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editComposer, setEditComposer] = useState<"manual" | "maker">("manual");
  const [editText, setEditText] = useState("");
  const [makerEditRequest, setMakerEditRequest] = useState("");
  const [editDraft, setEditDraft] = useState<ProjectEditDraft | null>(null);
  const [editOutcome, setEditOutcome] = useState<{
    record: ProjectEditRecord;
    restored: boolean;
  } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [evidenceResult, setEvidenceResult] = useState<ProjectSearchResult | null>(
    null
  );
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const handledOrientation = useRef<string | null>(null);

  const selectedProject = useMemo(
    () => catalog?.projects.find((project) => project.id === selectedId) ?? null,
    [catalog, selectedId]
  );

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return catalog?.projects ?? [];
    return (catalog?.projects ?? []).filter((project) =>
      `${project.name} ${project.rootPath}`.toLocaleLowerCase().includes(query)
    );
  }, [catalog, search]);

  const projectNotes = useMemo(
    () =>
      notes.filter(
        (note) =>
          note.kind === "note" &&
          !note.archived &&
          note.workspaceProjectId === selectedProject?.id
      ),
    [notes, selectedProject?.id]
  );

  const projectReferences = useMemo(
    () =>
      notes.filter(
        (item) =>
          item.kind === "link" &&
          !item.archived &&
          item.workspaceProjectId === selectedProject?.id &&
          item.reference
      ),
    [notes, selectedProject?.id]
  );

  async function saveProjectNote(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = noteDraft.trim();
    if (!text || !selectedProject || noteSaving) return;
    setNoteSaving(true);
    try {
      await onCaptureNote(`@note @"${selectedProject.name}" ${text}`);
      setNoteDraft("");
    } finally {
      setNoteSaving(false);
    }
  }

  async function updateProjectNote(
    note: CaptureRecord,
    patch: CapturePatch
  ): Promise<void> {
    if (noteBusyId) return;
    setNoteBusyId(note.id);
    try {
      await onUpdateNote(note.id, patch);
    } finally {
      setNoteBusyId(null);
    }
  }

  async function loadCatalog(refresh = false): Promise<void> {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const next = await window.hearth.listWorkspaceProjects(refresh);
      setCatalog(next);
      const availableId = next.projects.some((project) => project.id === selectedId)
        ? selectedId
        : next.selectedProject.id;
      setSelectedId(availableId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Projects could not be discovered.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    if (!selectedId || !catalog?.projects.some((project) => project.id === selectedId)) {
      return;
    }
    let current = true;
    setLoading(true);
    setError(null);
    setPreview(null);
    setEditOpen(false);
    setEvidenceOpen(false);
    setEvidenceResult(null);
    setSelectedPaths([]);
    Promise.all([
      window.hearth.getWorkspaceProject(selectedId),
      window.hearth.listProjectDirectory(selectedId, ""),
      window.hearth.readProjectDiff(selectedId),
      window.hearth.listProjectEdits(selectedId)
    ])
      .then(([nextDetail, nextDirectory, nextDiff, nextEdits]) => {
        if (!current) return;
        setDetail(nextDetail);
        setDirectory(nextDirectory);
        setDiff(nextDiff);
        setRecentEdits(nextEdits);
      })
      .catch((reason: unknown) => {
        if (!current) return;
        setError(reason instanceof Error ? reason.message : "This project could not be inspected.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [catalog, selectedId]);

  useEffect(() => {
    if (
      !orientation?.path ||
      orientation.projectId !== selectedId ||
      !detail ||
      handledOrientation.current === orientation.requestId
    ) {
      return;
    }
    handledOrientation.current = orientation.requestId;
    let current = true;
    const parentPath = orientation.path.split("/").slice(0, -1).join("/");
    setError(null);
    Promise.all([
      window.hearth.readProjectFile(orientation.projectId, orientation.path),
      window.hearth.listProjectDirectory(orientation.projectId, parentPath)
    ])
      .then(([nextPreview, nextDirectory]) => {
        if (!current) return;
        setPreview(nextPreview);
        setDirectory(nextDirectory);
        setSelectedPaths([nextPreview.path]);
        setMode("files");
        onNotify(`${nextPreview.path} opened from Archive.`);
      })
      .catch((reason: unknown) => {
        if (!current) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "That archived file could not be opened."
        );
      })
    return () => {
      current = false;
    };
  }, [detail, onNotify, orientation, selectedId]);

  async function openDirectory(projectPath: string): Promise<void> {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      setDirectory(
        await window.hearth.listProjectDirectory(selectedProject.id, projectPath)
      );
      setPreview(null);
      setMode("files");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That folder could not be opened.");
    } finally {
      setLoading(false);
    }
  }

  async function openFile(projectPath: string): Promise<void> {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      setPreview(await window.hearth.readProjectFile(selectedProject.id, projectPath));
      setSelectedPaths([projectPath]);
      setMode("files");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That file could not be previewed.");
    } finally {
      setLoading(false);
    }
  }

  async function openChange(projectPath: string): Promise<void> {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      setDiff(await window.hearth.readProjectDiff(selectedProject.id, projectPath));
      setMode("changes");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That change could not be reviewed.");
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(): void {
    if (!preview?.editable) {
      onNotify(preview?.editReason ?? "That file remains read-only.");
      return;
    }
    setEditText(preview.text.replace(/^\uFEFF/, ""));
    setEditComposer("manual");
    setMakerEditRequest("");
    setEditDraft(null);
    setEditOutcome(null);
    setEditOpen(true);
  }

  function beginMakerEdit(): void {
    if (!preview?.editable) {
      onNotify(preview?.editReason ?? "That file remains read-only.");
      return;
    }
    setEditText(preview.text.replace(/^\uFEFF/, ""));
    setEditComposer("maker");
    setMakerEditRequest("");
    setEditDraft(null);
    setEditOutcome(null);
    setEditOpen(true);
  }

  function closeEdit(): void {
    if (editBusy) return;
    setEditOpen(false);
    setEditDraft(null);
    setEditOutcome(null);
  }

  async function reviewEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedProject || !preview || editBusy) return;
    setEditBusy(true);
    try {
      setEditDraft(
        await window.hearth.prepareProjectEdit(
          selectedProject.id,
          preview.path,
          editText
        )
      );
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "That edit could not be prepared."
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function proposeEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (
      !selectedProject ||
      !preview ||
      !makerEditRequest.trim() ||
      editBusy
    ) {
      return;
    }
    setEditBusy(true);
    try {
      const result = await window.hearth.proposeProjectEdit(
        selectedProject.id,
        preview.path,
        makerEditRequest
      );
      setEditText(result.proposedText);
      setEditDraft(result.draft);
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "Maker could not draft that file."
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function critiqueEdit(): Promise<void> {
    if (!editDraft || editDraft.origin !== "maker" || editBusy) return;
    setEditBusy(true);
    try {
      const result = await window.hearth.critiqueProjectEdit(editDraft.id);
      setEditDraft(result.draft);
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "Critic could not review that patch."
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function refreshAfterEdit(
    projectId: string,
    nextPreview: ProjectFilePreview
  ): Promise<void> {
    const parentPath = nextPreview.path.split("/").slice(0, -1).join("/");
    const [nextDetail, nextDiff, nextEdits, nextDirectory] = await Promise.all([
      window.hearth.getWorkspaceProject(projectId),
      window.hearth.readProjectDiff(projectId),
      window.hearth.listProjectEdits(projectId),
      window.hearth.listProjectDirectory(projectId, parentPath)
    ]);
    setPreview(nextPreview);
    setDetail(nextDetail);
    setDiff(nextDiff);
    setRecentEdits(nextEdits);
    setDirectory(nextDirectory);
    setMode("files");
  }

  async function applyEdit(): Promise<void> {
    if (!editDraft || editBusy) return;
    setEditBusy(true);
    try {
      const result = await window.hearth.applyProjectEdit(editDraft.id);
      setPreview(result.preview);
      setEditOutcome({ record: result.record, restored: false });
      try {
        await refreshAfterEdit(editDraft.projectId, result.preview);
        onNotify(`${result.record.path} was updated. A private Undo backup is ready.`);
      } catch {
        onNotify(
          `${result.record.path} was updated safely, but the Project summary needs a refresh.`
        );
      }
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "Hearth did not apply that edit."
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function restoreEdit(record: ProjectEditRecord): Promise<void> {
    if (editBusy) return;
    setEditBusy(true);
    try {
      const result = await window.hearth.restoreProjectEdit(record.id);
      setPreview(result.preview);
      setEditOutcome({ record: result.record, restored: true });
      setEditOpen(true);
      try {
        await refreshAfterEdit(record.projectId, result.preview);
        onNotify(`${result.record.path} was restored from its Hearth backup.`);
      } catch {
        onNotify(
          `${result.record.path} was restored safely, but the Project summary needs a refresh.`
        );
      }
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "That edit could not be undone."
      );
    } finally {
      setEditBusy(false);
    }
  }

  function openEvidenceShelf(): void {
    setEvidenceQuery("");
    setEvidenceResult(null);
    setEvidenceOpen(true);
  }

  function closeEvidenceShelf(): void {
    if (evidenceBusy) return;
    setEvidenceOpen(false);
  }

  async function searchEvidence(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedProject || evidenceQuery.trim().length < 2 || evidenceBusy) return;
    setEvidenceBusy(true);
    try {
      setEvidenceResult(
        await window.hearth.searchProjectFiles(
          selectedProject.id,
          evidenceQuery.trim()
        )
      );
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "Hearth could not search this project."
      );
    } finally {
      setEvidenceBusy(false);
    }
  }

  function toggleEvidencePath(projectPath: string): void {
    setSelectedPaths((current) => {
      if (current.includes(projectPath)) {
        return current.filter((candidate) => candidate !== projectPath);
      }
      if (current.length >= 6) {
        onNotify("The evidence shelf holds up to six files.");
        return current;
      }
      return [...current, projectPath];
    });
  }

  async function shareEvidence(agent: ContextAgent): Promise<void> {
    if (!selectedProject || !selectedPaths.length || evidenceBusy) return;
    setEvidenceBusy(true);
    try {
      await onShareContext(
        agent,
        selectedProject,
        "evidence",
        undefined,
        selectedPaths
      );
      setEvidenceOpen(false);
    } finally {
      setEvidenceBusy(false);
    }
  }

  const crumbs = (directory?.path ?? "")
    .split("/")
    .filter(Boolean);
  const changeCount = diff?.changes.length ?? detail?.changeCount ?? 0;
  const contextKind: AgentContextKind =
    mode === "changes"
      ? "diff"
      : selectedPaths.length > 1
        ? "evidence"
        : selectedPaths.length === 1
          ? "file"
          : "project";
  const contextPath =
    contextKind === "diff"
      ? diff?.path ?? undefined
      : contextKind === "file"
        ? selectedPaths[0]
        : undefined;
  const contextPaths = contextKind === "evidence" ? selectedPaths : undefined;
  const handoffScope =
    mode === "changes"
      ? diff?.path
        ? "This change"
        : "All changes"
      : selectedPaths.length
        ? `${selectedPaths.length} ${selectedPaths.length === 1 ? "file" : "files"}`
        : "Project review";
  const latestUndoableEdit = recentEdits.find((edit) => !edit.restoredAt) ?? null;

  return (
    <div className="project-surface" aria-label="Project surface">
      <aside className="project-catalog">
        <div className="project-catalog__heading">
          <div>
            <p className="eyebrow">Project shelf</p>
            <strong>{catalog?.projects.length ?? "—"} discovered</strong>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Refresh projects"
            title="Refresh projects"
            disabled={refreshing}
            onClick={() => void loadCatalog(true)}
          >
            {refreshing ? "…" : "↻"}
          </button>
        </div>
        <label className="project-search">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Find a project</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a project"
          />
        </label>
        <div className="project-list">
          {filteredProjects.map((project) => (
            <button
              className={classNames(
                "project-list-item",
                project.id === selectedId && "is-active"
              )}
              key={project.id}
              type="button"
              onClick={() => setSelectedId(project.id)}
            >
              <span className="project-list-glyph">
                {project.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong title={project.name}>{project.name}</strong>
                <small title={project.rootPath}>
                  {project.branch ?? (project.signals.join(" · ") || "local project")}
                </small>
              </span>
              {project.selected ? <i title="Current working project">●</i> : null}
            </button>
          ))}
          {!loading && filteredProjects.length === 0 ? (
            <p className="project-list-empty">No project matches that search.</p>
          ) : null}
        </div>
        <p className="catalog-footnote">
          Repositories and clear Claude/Codex projects under your home folder.
        </p>
      </aside>

      <section className="project-browser">
        <header className="project-browser__header">
          <div className="project-title">
            <span>{selectedProject?.name.slice(0, 1).toUpperCase() ?? "H"}</span>
            <div>
              <h2>{selectedProject?.name ?? "Choose a project"}</h2>
              <p title={selectedProject?.rootPath}>{selectedProject?.rootPath}</p>
            </div>
          </div>
          <div className="project-browser__actions">
            <button
              className="small-button small-button--quiet"
              type="button"
              disabled={!selectedProject}
              onClick={() => {
                if (!selectedProject) return;
                void window.hearth
                  .writeClipboard(selectedProject.rootPath)
                  .then(() => onNotify("Project path copied."))
                  .catch((reason: unknown) =>
                    onNotify(
                      reason instanceof Error ? reason.message : "The path could not be copied."
                    )
                  );
              }}
            >
              Copy path
            </button>
            <button
              className="small-button"
              type="button"
              disabled={!selectedProject}
              onClick={() => selectedProject && void onWorkHere(selectedProject)}
            >
              {terminalLive ? "Use next" : "Work here"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </header>

        <div className="project-browser__tabs">
          <button
            className={mode === "files" ? "is-active" : ""}
            type="button"
            onClick={() => setMode("files")}
          >
            Files
          </button>
          <button
            className={mode === "changes" ? "is-active" : ""}
            type="button"
            onClick={() => setMode("changes")}
          >
            Changes <span>{changeCount}</span>
          </button>
          <button
            className={mode === "notes" ? "is-active" : ""}
            type="button"
            onClick={() => setMode("notes")}
          >
            Notes & refs <span>{projectNotes.length + projectReferences.length}</span>
          </button>
          <div className="project-browser__tools">
            <button
              className="project-evidence-button"
              type="button"
              disabled={!selectedProject}
              onClick={openEvidenceShelf}
            >
              Find context
              {selectedPaths.length ? <span>{selectedPaths.length}</span> : null}
            </button>
            <div className="project-handoff-scope" aria-live="polite">
              <span>{handoffScope}</span>
              {mode === "files" && selectedPaths.length ? (
                <button
                  type="button"
                  aria-label="Clear selected files"
                  onClick={() => setSelectedPaths([])}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <button
              type="button"
              disabled={!selectedProject}
              onClick={() =>
                selectedProject &&
                void onShareContext(
                  "maker",
                  selectedProject,
                  contextKind,
                  contextPath,
                  contextPaths
                )
              }
            >
              To Maker
            </button>
            <button
              className="project-critic-button"
              type="button"
              disabled={!selectedProject}
              onClick={() =>
                selectedProject &&
                void onShareContext(
                  "critic",
                  selectedProject,
                  contextKind,
                  contextPath,
                  contextPaths
                )
              }
            >
              To Critic
            </button>
          </div>
        </div>

        {error ? (
          <div className="project-error" role="alert">
            <span>!</span>
            <p>{error}</p>
          </div>
        ) : null}

        {mode === "files" ? (
          <div className="project-browser__body">
            <nav className="breadcrumbs" aria-label="Project path">
              <button type="button" onClick={() => void openDirectory("")}>
                {selectedProject?.name ?? "Project"}
              </button>
              {crumbs.map((crumb, index) => {
                const crumbPath = crumbs.slice(0, index + 1).join("/");
                return (
                  <span key={crumbPath}>
                    <i>/</i>
                    <button type="button" onClick={() => void openDirectory(crumbPath)}>
                      {crumb}
                    </button>
                  </span>
                );
              })}
              {preview ? (
                <span>
                  <i>/</i>
                  <strong>{preview.name}</strong>
                </span>
              ) : null}
            </nav>
            {preview ? (
              <>
                <div className="preview-meta">
                  <span>{preview.language}</span>
                  <span>{preview.lineCount.toLocaleString()} lines</span>
                  <span>{formatBytes(preview.size)}</span>
                  <button
                    className="preview-maker-button"
                    type="button"
                    disabled={!preview.editable}
                    title={preview.editReason ?? "Ask Maker to draft one bounded edit"}
                    onClick={beginMakerEdit}
                  >
                    Ask Maker
                  </button>
                  <button
                    className="preview-edit-button"
                    type="button"
                    disabled={!preview.editable}
                    title={preview.editReason ?? "Review a bounded edit"}
                    onClick={beginEdit}
                  >
                    {preview.editable ? "Edit file" : "Read only"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void window.hearth
                        .writeClipboard(preview.text)
                        .then(() => onNotify("File text copied."))
                        .catch((reason: unknown) =>
                          onNotify(
                            reason instanceof Error
                              ? reason.message
                              : "The file text could not be copied."
                          )
                        );
                    }}
                  >
                    Copy file
                  </button>
                </div>
                <FileView preview={preview} />
              </>
            ) : (
              <div className="directory-list" aria-busy={loading}>
                {directory?.path ? (
                  <button
                    className="directory-row directory-row--up"
                    type="button"
                    onClick={() => {
                      const parent = directory.path.split("/").slice(0, -1).join("/");
                      void openDirectory(parent);
                    }}
                  >
                    <span>↰</span>
                    <strong>Up one level</strong>
                  </button>
                ) : null}
                {directory?.entries.map((entry) => {
                  const selected =
                    entry.kind === "file" && selectedPaths.includes(entry.path);
                  return (
                    <button
                      className={classNames("directory-row", selected && "is-selected")}
                      key={entry.path}
                      type="button"
                      disabled={entry.kind === "symlink"}
                      aria-pressed={entry.kind === "file" ? selected : undefined}
                      title={
                        entry.kind === "symlink"
                          ? "Links are not followed in preview"
                          : entry.kind === "file"
                            ? `${entry.path} · Ctrl+click to add or remove from handoff`
                            : entry.path
                      }
                      onClick={(event) => {
                        if (entry.kind === "directory") {
                          void openDirectory(entry.path);
                        } else if (event.ctrlKey || event.metaKey) {
                          toggleEvidencePath(entry.path);
                        } else {
                          void openFile(entry.path);
                        }
                      }}
                    >
                      <span className={`entry-glyph entry-glyph--${entry.kind}`}>
                        {selected
                          ? "✓"
                          : entry.kind === "directory"
                            ? "▰"
                            : entry.kind === "symlink"
                              ? "↗"
                              : fileGlyph(entry.name)}
                      </span>
                      <strong>{entry.name}</strong>
                      <small>
                        {entry.kind === "directory" ? "Folder" : formatBytes(entry.size)}
                      </small>
                      <time>{formatDate(entry.modifiedAt)}</time>
                    </button>
                  );
                })}
                {loading ? <div className="project-loading">Reading the room…</div> : null}
                {!loading && directory?.entries.length === 0 ? (
                  <div className="project-empty">
                    <span>□</span>
                    <h3>This folder is empty</h3>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : mode === "notes" ? (
          <div className="project-notes">
            <form className="project-note-composer" onSubmit={(event) => void saveProjectNote(event)}>
              <div>
                <p className="eyebrow">Leave it with this project</p>
                <h3>A note stays connected without becoming another file.</h3>
              </div>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder={
                  selectedProject
                    ? `Remember something about ${selectedProject.name}…`
                    : "Choose a project first…"
                }
                disabled={!selectedProject || noteSaving}
                maxLength={8_000}
                rows={3}
              />
              <button
                className="small-button"
                type="submit"
                disabled={!selectedProject || !noteDraft.trim() || noteSaving}
              >
                {noteSaving ? "Keeping…" : "Keep note"}
              </button>
            </form>
            <div className="project-note-list">
              {projectNotes.map((note) => (
                <article className="project-note-card" key={note.id}>
                  <header>
                    <span>Connected note</span>
                    <time>{formatDate(note.updatedAt)}</time>
                  </header>
                  {note.title ? <h3>{note.title}</h3> : null}
                  <p>{note.text}</p>
                  {note.description ? <small>{note.description}</small> : null}
                  {note.tags.length ? (
                    <div className="project-note-tags">
                      {note.tags.map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="project-note-actions">
                    <button type="button" onClick={() => onOpenNote(note.id)}>
                      Open in Studio <span aria-hidden="true">→</span>
                    </button>
                    <button
                      type="button"
                      disabled={noteBusyId === note.id}
                      onClick={() =>
                        void updateProjectNote(note, { workspaceProjectId: null })
                      }
                    >
                      Remove from project
                    </button>
                    <button
                      type="button"
                      disabled={noteBusyId === note.id}
                      onClick={() =>
                        void updateProjectNote(note, { archived: true })
                      }
                    >
                      Put away
                    </button>
                  </div>
                </article>
              ))}
              {projectReferences.map((item) => (
                <article className="project-reference-card" key={item.id}>
                  <ReferenceCard
                    reference={item.reference!}
                    onOpen={() => void window.hearth.openExternal(item.reference!.canonicalUrl)}
                  />
                  <small>Connected Library reference · read-only here</small>
                </article>
              ))}
              {!projectNotes.length && !projectReferences.length ? (
                <div className="project-empty project-note-empty">
                  <span>✎</span>
                  <h3>No notes left with this project yet</h3>
                  <p>Anything kept here will also be searchable throughout Hearth.</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="project-changes">
            <aside className="change-list">
              <button
                className={!diff?.path ? "is-active" : ""}
                type="button"
                onClick={() => selectedProject && void openChange("")}
              >
                <span>Σ</span>
                <strong>All changes</strong>
                <small>{changeCount}</small>
              </button>
              {diff?.changes.map((change) => (
                <button
                  className={change.path === diff.path ? "is-active" : ""}
                  type="button"
                  key={`${change.status}-${change.path}`}
                  title={change.path}
                  onClick={() => void openChange(change.path)}
                >
                  <span className={change.untracked ? "status-new" : "status-changed"}>
                    {change.untracked ? "U" : change.status.trim() || "M"}
                  </span>
                  <strong>{change.path}</strong>
                  <small>{change.staged ? "staged" : "working"}</small>
                </button>
              ))}
            </aside>
            <div className="diff-pane" aria-busy={loading}>
              <div className="diff-pane__heading">
                <strong>{diff?.path ?? "Complete working diff"}</strong>
                <span>{diff?.truncated ? "bounded preview" : "read-only review"}</span>
              </div>
              {diff ? <DiffView diff={diff} /> : null}
            </div>
          </div>
        )}
      </section>

      <aside className="project-inspector">
        <section>
          <p className="eyebrow">At a glance</p>
          <p className="project-description">
            {detail?.description ?? "A local working project discovered by its repository or agent signals."}
          </p>
          <dl className="project-facts-list">
            <div>
              <dt>Branch</dt>
              <dd>{detail?.project.branch ?? "Not a Git repository"}</dd>
            </div>
            <div>
              <dt>Changes</dt>
              <dd>{detail ? `${detail.changeCount} files` : "Checking…"}</dd>
            </div>
            <div>
              <dt>Stack</dt>
              <dd>
                {[detail?.packageManager, ...(detail?.languages ?? []).slice(0, 2)]
                  .filter(Boolean)
                  .join(" · ") || "Not identified"}
              </dd>
            </div>
          </dl>
        </section>
        <section>
          <p className="eyebrow">Latest commit</p>
          <p className="latest-commit">{detail?.latestCommit ?? "No commit summary available."}</p>
        </section>
        {latestUndoableEdit ? (
          <section className="project-edit-history">
            <p className="eyebrow">Last Hearth edit</p>
            <strong title={latestUndoableEdit.path}>{latestUndoableEdit.path}</strong>
            <p>
              +{latestUndoableEdit.additions} / −{latestUndoableEdit.deletions} ·{" "}
              {formatDate(latestUndoableEdit.appliedAt)}
            </p>
            <button
              type="button"
              disabled={editBusy}
              onClick={() => void restoreEdit(latestUndoableEdit)}
            >
              Undo this edit
            </button>
          </section>
        ) : null}
        <section className="project-review-note">
          <p className="eyebrow">Review posture</p>
          <strong>Look first. Change deliberately.</strong>
          <p>
            Small UTF-8 files can now be edited through a reviewed patch and private
            recovery backup. Everything else stays read-only.
          </p>
          <button className="text-button" type="button" onClick={onOpenMaker}>
            Talk it through with Maker <span aria-hidden="true">→</span>
          </button>
        </section>
      </aside>

      {evidenceOpen && selectedProject
        ? createPortal(
            <div
              className="project-evidence-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeEvidenceShelf();
              }}
            >
              <section
                className="project-evidence-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="project-evidence-title"
              >
                <header>
                  <div>
                    <p className="eyebrow">Deliberate project context</p>
                    <h2 id="project-evidence-title">Build an evidence shelf</h2>
                    <p>{selectedProject.name} · handoffs keep paths, never source</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close evidence shelf"
                    disabled={evidenceBusy}
                    onClick={closeEvidenceShelf}
                  >
                    ×
                  </button>
                </header>
                <div className="project-evidence-layout">
                  <section className="project-evidence-search">
                    <form onSubmit={(event) => void searchEvidence(event)}>
                      <label htmlFor="project-evidence-query">
                        Find a filename, symbol, phrase, or responsibility
                      </label>
                      <div>
                        <input
                          id="project-evidence-query"
                          value={evidenceQuery}
                          maxLength={120}
                          autoFocus
                          placeholder="authentication, terminal resize, return pack…"
                          onChange={(event) => setEvidenceQuery(event.target.value)}
                        />
                        <button
                          className="primary-button"
                          disabled={evidenceBusy || evidenceQuery.trim().length < 2}
                        >
                          {evidenceBusy ? "Searching…" : "Search project"}
                        </button>
                      </div>
                    </form>
                    <div className="project-evidence-results" aria-busy={evidenceBusy}>
                      {evidenceResult ? (
                        <>
                          <div className="project-evidence-result-meta">
                            <span>
                              {evidenceResult.matches.length} matches ·{" "}
                              {evidenceResult.scannedFiles.toLocaleString()} files checked
                            </span>
                            {evidenceResult.truncated ? (
                              <small>bounded result</small>
                            ) : null}
                          </div>
                          {evidenceResult.matches.map((match) => {
                            const selected = selectedPaths.includes(match.path);
                            return (
                              <button
                                className={classNames(
                                  "project-evidence-result",
                                  selected && "is-selected"
                                )}
                                type="button"
                                key={match.path}
                                aria-pressed={selected}
                                onClick={() => toggleEvidencePath(match.path)}
                              >
                                <span aria-hidden="true">{selected ? "✓" : "+"}</span>
                                <div>
                                  <strong>{match.path}</strong>
                                  <p>{match.snippet}</p>
                                  <small>
                                    {match.language}
                                    {match.line ? ` · line ${match.line}` : " · path match"}
                                    {` · ${formatBytes(match.size)}`}
                                  </small>
                                </div>
                              </button>
                            );
                          })}
                          {!evidenceBusy && evidenceResult.matches.length === 0 ? (
                            <div className="project-evidence-empty">
                              <strong>No useful match surfaced.</strong>
                              <p>Try a filename, symbol, or a shorter phrase.</p>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="project-evidence-empty">
                          <strong>Search stays local and bounded.</strong>
                          <p>
                            Generated folders, hidden settings, credentials, binaries,
                            and lockfiles stay out of this surface.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                  <aside className="project-evidence-shelf">
                    <header>
                      <div>
                        <p className="eyebrow">Selected evidence</p>
                        <strong>{selectedPaths.length} of 6 files</strong>
                      </div>
                      {selectedPaths.length ? (
                        <button
                          type="button"
                          disabled={evidenceBusy}
                          onClick={() => setSelectedPaths([])}
                        >
                          Clear
                        </button>
                      ) : null}
                    </header>
                    <div>
                      {selectedPaths.map((projectPath, index) => (
                        <article key={projectPath}>
                          <span>{index + 1}</span>
                          <strong title={projectPath}>{projectPath}</strong>
                          <button
                            type="button"
                            aria-label={`Remove ${projectPath}`}
                            disabled={evidenceBusy}
                            onClick={() => toggleEvidencePath(projectPath)}
                          >
                            ×
                          </button>
                        </article>
                      ))}
                      {!selectedPaths.length ? (
                        <div className="project-evidence-shelf-empty">
                          <span>＋</span>
                          <p>Choose only the files that genuinely belong in the question.</p>
                        </div>
                      ) : null}
                    </div>
                    <footer>
                      <p>
                        Residents see this exact set only when you ask a relevant
                        question. No terminal or whole-repo access is added.
                      </p>
                      <button
                        type="button"
                        disabled={!selectedPaths.length || evidenceBusy}
                        onClick={() => void shareEvidence("critic")}
                      >
                        Send to Critic
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={!selectedPaths.length || evidenceBusy}
                        onClick={() => void shareEvidence("maker")}
                      >
                        Send to Maker
                      </button>
                    </footer>
                  </aside>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}

      {editOpen && preview ? createPortal((
        <div
          className="project-edit-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEdit();
          }}
        >
          <section
            className="project-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-edit-title"
          >
            <header>
              <div>
                <p className="eyebrow">
                  {editOutcome
                    ? editOutcome.restored
                      ? "Restored safely"
                      : "Edit applied"
                    : editDraft
                      ? editDraft.origin === "maker"
                        ? "Maker’s proposed edit"
                        : "Review before writing"
                      : editComposer === "maker"
                        ? "Ask Maker for one change"
                        : "Bounded file edit"}
                </p>
                <h2 id="project-edit-title">{preview.path}</h2>
              </div>
              <button
                type="button"
                aria-label="Close editor"
                disabled={editBusy}
                onClick={closeEdit}
              >
                ×
              </button>
            </header>

            {editOutcome ? (
              <div className="project-edit-complete">
                <span aria-hidden="true">{editOutcome.restored ? "↶" : "✓"}</span>
                <h3>
                  {editOutcome.restored
                    ? "The previous file is back."
                    : "The reviewed edit is on disk."}
                </h3>
                <p>
                  {editOutcome.restored
                    ? "Hearth verified the backup and restored it without touching any other file."
                    : "Hearth verified the written file. The original remains available as a private Undo backup."}
                </p>
                <div>
                  {!editOutcome.restored ? (
                    <button
                      type="button"
                      disabled={editBusy}
                      onClick={() => void restoreEdit(editOutcome.record)}
                    >
                      Undo this edit
                    </button>
                  ) : null}
                  <button
                    className="primary-button"
                    type="button"
                    disabled={editBusy}
                    onClick={closeEdit}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : editDraft ? (
              <div
                className={classNames(
                  "project-edit-review",
                  editDraft.proposal && "has-resident-review"
                )}
              >
                {editDraft.proposal ? (
                  <div className="project-edit-resident-row">
                    <section className="project-edit-resident project-edit-resident--maker">
                      <header>
                        <span aria-hidden="true">M</span>
                        <div>
                          <p className="eyebrow">Maker’s proposal</p>
                          <strong>{editDraft.proposal.summary}</strong>
                        </div>
                      </header>
                      <p>{editDraft.proposal.rationale}</p>
                      <small>
                        Maker drafted this text from the selected file only. He cannot
                        Apply it.
                      </small>
                    </section>
                    <section
                      className={classNames(
                        "project-edit-resident",
                        "project-edit-resident--critic",
                        editDraft.critique &&
                          `is-${editDraft.critique.verdict}`
                      )}
                    >
                      {editDraft.critique ? (
                        <>
                          <header>
                            <span aria-hidden="true">C</span>
                            <div>
                              <p className="eyebrow">Critic’s independent read</p>
                              <strong>
                                {editDraft.critique.verdict === "support"
                                  ? "Supports this patch"
                                  : editDraft.critique.verdict === "object"
                                    ? "Objects to this patch"
                                    : "Proceed with caution"}
                              </strong>
                            </div>
                          </header>
                          <p>{editDraft.critique.summary}</p>
                          {editDraft.critique.concerns.length ? (
                            <ul>
                              {editDraft.critique.concerns.map((concern) => (
                                <li key={concern}>{concern}</li>
                              ))}
                            </ul>
                          ) : null}
                          {editDraft.critique.suggestedChecks.length ? (
                            <small>
                              Check: {editDraft.critique.suggestedChecks.join(" · ")}
                            </small>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <header>
                            <span aria-hidden="true">C</span>
                            <div>
                              <p className="eyebrow">Critic</p>
                              <strong>Not asked yet</strong>
                            </div>
                          </header>
                          <p>
                            Critic sees the original and proposed file separately. He
                            doesn’t inherit Maker’s conversation or authority.
                          </p>
                          <button
                            type="button"
                            disabled={editBusy}
                            onClick={() => void critiqueEdit()}
                          >
                            {editBusy ? "Reviewing…" : "Ask Critic to review"}
                          </button>
                        </>
                      )}
                    </section>
                  </div>
                ) : null}
                <div className="project-edit-summary">
                  <div>
                    <strong>+{editDraft.additions}</strong>
                    <span>added</span>
                  </div>
                  <div>
                    <strong>−{editDraft.deletions}</strong>
                    <span>removed</span>
                  </div>
                  <p>
                    This preview expires in 20 minutes and is tied to the file you
                    opened. A newer disk change will stop Apply.
                  </p>
                </div>
                <div className="project-edit-validations">
                  {editDraft.validations.map((validation) => (
                    <div
                      className={validation.status === "warning" ? "is-warning" : ""}
                      key={validation.kind}
                    >
                      <span>{validation.status === "warning" ? "!" : "✓"}</span>
                      <p>{validation.message}</p>
                    </div>
                  ))}
                </div>
                <ProjectEditDiff draft={editDraft} />
                <footer>
                  <button
                    type="button"
                    disabled={editBusy}
                    onClick={() => {
                      setEditDraft(null);
                      setEditComposer("manual");
                    }}
                  >
                    {editDraft.origin === "maker" ? "Adjust it myself" : "Back to edit"}
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={editBusy}
                    onClick={() => void applyEdit()}
                  >
                    {editBusy ? "Applying…" : "Apply this edit"}
                  </button>
                </footer>
              </div>
            ) : editComposer === "maker" ? (
              <form
                className="project-edit-maker-compose"
                onSubmit={(event) => void proposeEdit(event)}
              >
                <div className="project-edit-maker-intro">
                  <span aria-hidden="true">M</span>
                  <div>
                    <strong>What should change in this file?</strong>
                    <p>
                      Maker gets this selected file and your request—nothing else. He
                      returns a draft for review, never a write.
                    </p>
                  </div>
                </div>
                <label htmlFor="project-edit-maker-request">Change request</label>
                <textarea
                  id="project-edit-maker-request"
                  value={makerEditRequest}
                  maxLength={2_000}
                  autoFocus
                  placeholder="For example: simplify the empty state copy without changing its behavior."
                  onChange={(event) => setMakerEditRequest(event.target.value)}
                />
                <div className="project-edit-boundary">
                  <span>One selected file</span>
                  <span>No tools or terminal</span>
                  <span>You remain the only Apply authority</span>
                </div>
                <footer>
                  <p>
                    Open-ended drafts use Maker’s configured reasoning model. A literal
                    replacement also works in local mode.
                  </p>
                  <button type="button" disabled={editBusy} onClick={closeEdit}>
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    disabled={editBusy || !makerEditRequest.trim()}
                  >
                    {editBusy ? "Maker is drafting…" : "Draft this change"}
                  </button>
                </footer>
              </form>
            ) : (
              <form className="project-edit-compose" onSubmit={(event) => void reviewEdit(event)}>
                <div className="project-edit-boundary">
                  <span>One selected file</span>
                  <span>128 KB maximum</span>
                  <span>Private backup before write</span>
                </div>
                <label htmlFor="project-edit-text">File contents</label>
                <textarea
                  id="project-edit-text"
                  value={editText}
                  spellCheck={false}
                  onChange={(event) => setEditText(event.target.value)}
                />
                <footer>
                  <p>
                    Nothing is written during this step. Review creates the exact patch
                    and rechecks the safety boundary.
                  </p>
                  <button type="button" disabled={editBusy} onClick={closeEdit}>
                    Cancel
                  </button>
                  <button className="primary-button" disabled={editBusy}>
                    {editBusy ? "Checking…" : "Review changes"}
                  </button>
                </footer>
              </form>
            )}
          </section>
        </div>
      ), document.body) : null}
    </div>
  );
}
