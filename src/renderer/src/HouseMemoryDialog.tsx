import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import type {
  HouseMemoryInput,
  HouseMemoryKind,
  HouseMemoryRecord,
  HouseMemorySnapshot,
  WorkspaceProjectSummary
} from "../../shared/contracts";

const KIND_LABELS: Record<HouseMemoryKind, string> = {
  preference: "How I like things",
  workflow: "How I work",
  tool: "Tools I use",
  project: "Project context",
  resident: "Resident relationship"
};

const RESIDENT_LABELS = {
  companion: "Companion",
  maker: "Maker",
  librarian: "Librarian",
  critic: "Critic"
} as const;

function scopeTarget(memory: HouseMemoryRecord): string {
  if (memory.scope === "house") return "house";
  if (memory.scope === "project") return `project:${memory.subjectId ?? ""}`;
  return `resident:${memory.subjectId ?? "companion"}`;
}

function scopeLabel(memory: HouseMemoryRecord): string {
  if (memory.scope === "house") return "Whole house";
  return memory.subjectLabel ?? (memory.scope === "project" ? "Current project" : "Resident");
}

export function HouseMemoryDialog({
  snapshot,
  selectedProject,
  onChange,
  onClose,
  onNotify
}: {
  snapshot: HouseMemorySnapshot;
  selectedProject: WorkspaceProjectSummary;
  onChange: (snapshot: HouseMemorySnapshot) => void;
  onClose: () => void;
  onNotify: (message: string) => void;
}): ReactNode {
  const [adding, setAdding] = useState(
    snapshot.active.length === 0 && snapshot.suggested.length === 0
  );
  const [editing, setEditing] = useState<HouseMemoryRecord | null>(null);
  const [kind, setKind] = useState<HouseMemoryKind>("preference");
  const [target, setTarget] = useState("house");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmForget, setConfirmForget] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  function resetForm(): void {
    setEditing(null);
    setKind("preference");
    setTarget("house");
    setText("");
    setAdding(false);
  }

  function input(): HouseMemoryInput {
    if (target.startsWith("project:")) {
      const projectId = target.slice("project:".length);
      const editedProject =
        editing?.scope === "project" && editing.subjectId === projectId
          ? editing
          : null;
      return {
        kind,
        scope: "project",
        subjectId: projectId,
        subjectLabel: editedProject?.subjectLabel ?? selectedProject.name,
        text
      };
    }
    if (target.startsWith("resident:")) {
      const resident = target.slice("resident:".length) as keyof typeof RESIDENT_LABELS;
      return {
        kind,
        scope: "resident",
        subjectId: resident,
        subjectLabel: RESIDENT_LABELS[resident],
        text
      };
    }
    return {
      kind,
      scope: "house",
      subjectId: null,
      subjectLabel: null,
      text
    };
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(editing?.id ?? "new");
    try {
      const next = editing
        ? await window.hearth.updateHouseMemory(editing.id, input())
        : await window.hearth.saveHouseMemory(input());
      onChange(next);
      onNotify(editing ? "House Memory was corrected." : "House Memory was saved.");
      resetForm();
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "House Memory could not be saved."
      );
    } finally {
      setBusy(null);
    }
  }

  async function setSuggestion(
    memory: HouseMemoryRecord,
    state: "active" | "suggested" | "dismissed"
  ): Promise<void> {
    if (busy) return;
    setBusy(memory.id);
    try {
      onChange(
        await window.hearth.updateHouseMemory(memory.id, { state })
      );
      onNotify(
        state === "active"
          ? memory.practice
            ? "That practice is approved guidance now."
            : "That observation is now approved House Memory."
          : state === "suggested"
            ? "That observation is waiting for your decision again."
            : "Hearth will leave that observation alone."
      );
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "That observation could not change."
      );
    } finally {
      setBusy(null);
    }
  }

  async function forget(memory: HouseMemoryRecord): Promise<void> {
    if (confirmForget !== memory.id) {
      setConfirmForget(memory.id);
      return;
    }
    if (busy) return;
    setBusy(memory.id);
    try {
      onChange(await window.hearth.forgetHouseMemory(memory.id));
      onNotify("The house forgot that.");
      setConfirmForget(null);
      if (editing?.id === memory.id) resetForm();
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "That House Memory could not be forgotten."
      );
    } finally {
      setBusy(null);
    }
  }

  function edit(memory: HouseMemoryRecord): void {
    setEditing(memory);
    setAdding(true);
    setKind(memory.kind);
    setTarget(scopeTarget(memory));
    setText(memory.text);
  }

  return (
    <div
      className="house-memory-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="house-memory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="house-memory-title"
      >
        <header className="house-memory-heading">
          <div>
            <p className="eyebrow">House Memory</p>
            <h2 id="house-memory-title">What the house remembers</h2>
            <p>
              Memories are yours. Practices are suggestions until you approve
              them, and none of them can grant authority.
            </p>
          </div>
          <button type="button" aria-label="Close House Memory" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="house-memory-overview">
          <span>
            <strong>{snapshot.active.length}</strong>
            approved
          </span>
          <span>
            <strong>{snapshot.suggested.length}</strong>
            waiting
          </span>
          <p>
            Practices use lifecycle counts—never conversation, source, commands,
            or terminal output.
          </p>
        </div>

        <div className="house-memory-scroll">
          {snapshot.suggested.length ? (
            <section className="house-memory-section">
              <div className="house-memory-section-heading">
                <div>
                  <p className="eyebrow">Suggested practices</p>
                  <h3>Nothing changes until you say so.</h3>
                </div>
              </div>
              <div className="house-memory-list house-practice-list">
                {snapshot.suggested.map((memory) => (
                  <article className="house-memory-card is-suggestion" key={memory.id}>
                    <div className="house-memory-card-meta">
                      <span>{memory.practice ? "Practice suggestion" : KIND_LABELS[memory.kind]}</span>
                      <small>{scopeLabel(memory)}</small>
                    </div>
                    <p>{memory.text}</p>
                    {memory.reason ? <small>{memory.reason}</small> : null}
                    {memory.practice ? (
                      <div className="house-practice-details">
                        <div>
                          <strong>What approval changes</strong>
                          <p>{memory.practice.proposedEffect}</p>
                        </div>
                        <div className="house-practice-evidence">
                          <span>{memory.practice.evidenceCount} supporting records</span>
                          <span>Guidance only</span>
                        </div>
                        <details>
                          <summary>Why Hearth suggested this</summary>
                          <ul>
                            {memory.practice.provenance.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    ) : null}
                    <footer>
                      <button
                        type="button"
                        disabled={busy === memory.id}
                        onClick={() => void setSuggestion(memory, "active")}
                      >
                        {memory.practice ? "Adopt practice" : "Remember this"}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => edit(memory)}
                      >
                        Edit first
                      </button>
                      <button
                        type="button"
                        disabled={busy === memory.id}
                        onClick={() => void setSuggestion(memory, "dismissed")}
                      >
                        Not useful
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="house-memory-section">
            <div className="house-memory-section-heading">
              <div>
                <p className="eyebrow">Approved memory &amp; practices</p>
                <h3>
                  {snapshot.active.length
                    ? "Shared carefully when it matters."
                    : "The house isn’t assuming anything about you."}
                </h3>
              </div>
              {!adding ? (
                <button
                  className="small-button"
                  type="button"
                  onClick={() => setAdding(true)}
                >
                  Add something
                </button>
              ) : null}
            </div>

            {adding ? (
              <form className="house-memory-form" onSubmit={(event) => void save(event)}>
                <div className="house-memory-fields">
                  <label>
                    Kind
                    <select
                      aria-label="House Memory kind"
                      value={kind}
                      disabled={Boolean(editing?.practice)}
                      onChange={(event) =>
                        setKind(event.target.value as HouseMemoryKind)
                      }
                    >
                      {Object.entries(KIND_LABELS).map(([value, label]) => (
                        <option value={value} key={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Who should know
                    <select
                      aria-label="House Memory scope"
                      value={target}
                      disabled={Boolean(editing?.practice)}
                      onChange={(event) => setTarget(event.target.value)}
                    >
                      <option value="house">Everyone in the house</option>
                      <option value={`project:${selectedProject.id}`}>
                        Current project · {selectedProject.name}
                      </option>
                      {editing?.scope === "project" &&
                      editing.subjectId !== selectedProject.id ? (
                        <option value={`project:${editing.subjectId}`}>
                          Remembered project · {editing.subjectLabel}
                        </option>
                      ) : null}
                      {Object.entries(RESIDENT_LABELS).map(([value, label]) => (
                        <option value={`resident:${value}`} key={value}>
                          {label} only
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  What should Hearth remember?
                  <textarea
                    autoFocus
                    value={text}
                    maxLength={600}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="I prefer short return summaries with one recommended next action."
                  />
                </label>
                <footer>
                  <small>{text.length}/600 · editable and forgettable</small>
                  <div>
                    <button type="button" onClick={resetForm}>Cancel</button>
                    <button
                      className="small-button"
                      type="submit"
                      disabled={!text.trim() || Boolean(busy)}
                    >
                      {busy
                        ? "Saving…"
                        : editing
                          ? "Save correction"
                          : "Remember this"}
                    </button>
                  </div>
                </footer>
              </form>
            ) : null}

            {snapshot.active.length ? (
              <div className="house-memory-list">
                {snapshot.active.map((memory) => (
                  <article className="house-memory-card" key={memory.id}>
                    <div className="house-memory-card-meta">
                      <span>{KIND_LABELS[memory.kind]}</span>
                      <small>{scopeLabel(memory)}</small>
                    </div>
                    <p>{memory.text}</p>
                    <small>
                      {memory.source === "user"
                        ? "Added by you"
                        : "Practice you approved"}
                    </small>
                    {memory.practice ? (
                      <div className="house-practice-details is-approved">
                        <div>
                          <strong>Approved effect</strong>
                          <p>{memory.practice.proposedEffect}</p>
                        </div>
                        <div className="house-practice-evidence">
                          <span>{memory.practice.evidenceCount} supporting records at approval</span>
                          <span>No added authority</span>
                        </div>
                      </div>
                    ) : null}
                    <footer>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => edit(memory)}
                      >
                        Correct
                      </button>
                      <button
                        className={confirmForget === memory.id ? "is-confirming" : ""}
                        type="button"
                        disabled={busy === memory.id}
                        onClick={() => void forget(memory)}
                      >
                        {confirmForget === memory.id ? "Forget it" : "Forget"}
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          {showDismissed && snapshot.dismissed.length ? (
            <section className="house-memory-section">
              <div className="house-memory-section-heading">
                <div>
                  <p className="eyebrow">Ignored practices</p>
                  <h3>Still visible, still reversible.</h3>
                </div>
              </div>
              <div className="house-memory-list house-practice-list">
                {snapshot.dismissed.map((memory) => (
                  <article
                    className="house-memory-card is-dismissed"
                    key={memory.id}
                  >
                    <div className="house-memory-card-meta">
                      <span>{KIND_LABELS[memory.kind]}</span>
                      <small>Ignored</small>
                    </div>
                    <p>{memory.text}</p>
                    {memory.reason ? <small>{memory.reason}</small> : null}
                    {memory.practice ? (
                      <div className="house-practice-details">
                        <div>
                          <strong>Proposed effect</strong>
                          <p>{memory.practice.proposedEffect}</p>
                        </div>
                        <div className="house-practice-evidence">
                          <span>{memory.practice.evidenceCount} supporting records</span>
                          <span>Still ignored</span>
                        </div>
                      </div>
                    ) : null}
                    <footer>
                      <button
                        type="button"
                        disabled={busy === memory.id}
                        onClick={() => void setSuggestion(memory, "suggested")}
                      >
                        Put back
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <footer className="house-memory-boundary">
          {snapshot.dismissedCount ? (
            <button
              type="button"
              aria-expanded={showDismissed}
              onClick={() => setShowDismissed((current) => !current)}
            >
              {showDismissed ? "Hide" : "Review"} {snapshot.dismissedCount} ignored
            </button>
          ) : (
            <span>Declined observations stay ignored.</span>
          )}
          <strong>Memory and practices never grant terminal or file authority.</strong>
        </footer>
      </section>
    </div>
  );
}
