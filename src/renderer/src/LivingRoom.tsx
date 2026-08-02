import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  AgentKey,
  BootstrapData,
  LivingRoomEvent,
  LivingRoomMessage,
  LivingRoomMode,
  LivingRoomSnapshot
} from "../../shared/contracts";
import { ResidentAvatar } from "./ResidentAvatar";

const RESIDENTS: Array<{
  id: AgentKey;
  name: string;
  role: string;
}> = [
  { id: "maker", name: "Maker", role: "Practical builder" },
  { id: "critic", name: "Critic", role: "Independent resistance" },
  { id: "librarian", name: "Librarian", role: "Research & precedent" },
  { id: "companion", name: "Companion", role: "Perspective & synthesis" }
];

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function residentName(agent: AgentKey | null): string {
  return RESIDENTS.find((resident) => resident.id === agent)?.name ?? "Hearth";
}

function providerLabel(data: BootstrapData, agent: AgentKey): string {
  const resident = data.runtime.provider.residents?.[agent];
  if (resident) {
    if (resident.provider === "local") return resident.name;
    return resident.fallbackFrom
      ? `${resident.model ?? resident.name} · fallback`
      : resident.model ?? resident.name;
  }
  return data.runtime.provider.models[agent] ??
    (agent === "critic" ? "Codex" : "Claude Opus 5");
}

function CompanionFace({ thinking = false }: { thinking?: boolean }): ReactNode {
  return (
    <span
      className="companion-character companion-character--compact living-companion-face"
      data-mood={thinking ? "thinking" : "listening"}
      aria-hidden="true"
    >
      <span className="companion-spark"><i /></span>
      <span className="companion-ear companion-ear--left" />
      <span className="companion-ear companion-ear--right" />
      <span className="companion-body">
        <span className="companion-brows"><i /><i /></span>
        <span className="companion-eyes"><i><b /></i><i><b /></i></span>
        <span className="companion-cheeks"><i /><i /></span>
        <span className="companion-mouth" />
        <span className="companion-heart"><i /></span>
      </span>
      <span className="companion-arm companion-arm--left" />
      <span className="companion-arm companion-arm--right" />
      <span className="companion-foot companion-foot--left" />
      <span className="companion-foot companion-foot--right" />
    </span>
  );
}

function LivingPortrait({
  agent,
  thinking = false
}: {
  agent: AgentKey;
  thinking?: boolean;
}): ReactNode {
  return agent === "companion" ? (
    <CompanionFace thinking={thinking} />
  ) : (
    <ResidentAvatar
      resident={agent}
      mood={thinking ? "thinking" : "present"}
    />
  );
}

function modeCopy(mode: LivingRoomMode): {
  label: string;
  detail: string;
} {
  if (mode === "roundtable") {
    return {
      label: "Roundtable",
      detail: "Each selected resident adds one distinct perspective."
    };
  }
  if (mode === "challenge") {
    return {
      label: "Pressure test",
      detail: "Maker makes the case, Critic attacks it, Companion closes."
    };
  }
  return {
    label: "Conversation",
    detail: "Call one resident into an ordinary shared conversation."
  };
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>): void {
  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

export function LivingRoom({
  data,
  onSnapshotChange,
  onSaveDecision,
  onDraftDecision
}: {
  data: BootstrapData;
  onSnapshotChange: (snapshot: LivingRoomSnapshot) => void;
  onSaveDecision: (text: string) => Promise<void>;
  onDraftDecision: (text: string, destination: "study" | "workshop") => void;
}): ReactNode {
  const [snapshot, setSnapshot] = useState<LivingRoomSnapshot>(data.livingRoom);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    data.livingRoom.activeThreadId
  );
  const [mode, setMode] = useState<LivingRoomMode>("conversation");
  const [conversationResident, setConversationResident] =
    useState<AgentKey>("companion");
  const [roundtableResidents, setRoundtableResidents] = useState<AgentKey[]>([
    "maker",
    "critic"
  ]);
  const [challengeLibrarian, setChallengeLibrarian] = useState(false);
  const [includeProject, setIncludeProject] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentKey | null>(null);
  const [activeStage, setActiveStage] = useState("");
  const [streamText, setStreamText] = useState("");
  const [followLatest, setFollowLatest] = useState(true);
  const [opening, setOpening] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const openingRef = useRef(false);

  const activeThread = useMemo(
    () => [...snapshot.threads, ...snapshot.archivedThreads]
      .find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, snapshot.archivedThreads, snapshot.threads]
  );
  const activeArchived = Boolean(
    activeThreadId && snapshot.archivedThreads.some((thread) => thread.id === activeThreadId)
  );
  const visibleThreads = useMemo(() => {
    const query = threadSearch.trim().toLocaleLowerCase();
    const source = showArchived ? snapshot.archivedThreads : snapshot.threads;
    if (!query) return source;
    return source.filter((thread) =>
      [thread.title, thread.context?.label, ...thread.messages.map((entry) => entry.text)]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query))
    );
  }, [showArchived, snapshot.archivedThreads, snapshot.threads, threadSearch]);
  const decisionHandoff = useMemo(() => {
    if (!activeThread) return null;
    const userTopic = activeThread.messages.findLast((entry) => entry.role === "user")?.text;
    const finalTake = activeThread.messages.findLast((entry) => entry.role === "resident")?.text;
    if (!userTopic || !finalTake) return null;
    return `Living Room decision · ${activeThread.title}\n\nQuestion: ${userTopic}\n\nLatest household take: ${finalTake}`;
  }, [activeThread]);

  const participants = useMemo((): AgentKey[] => {
    if (mode === "conversation") return [conversationResident];
    if (mode === "challenge") {
      return challengeLibrarian
        ? ["maker", "critic", "librarian", "companion"]
        : ["maker", "critic", "companion"];
    }
    return roundtableResidents;
  }, [challengeLibrarian, conversationResident, mode, roundtableResidents]);

  const turnCount = participants.length;
  const turnSequence = participants.map(residentName).join(" → ");

  useEffect(() => {
    setSnapshot(data.livingRoom);
    setActiveThreadId((current) =>
      current && data.livingRoom.threads.some((thread) => thread.id === current)
        ? current
        : data.livingRoom.activeThreadId
    );
  }, [data.livingRoom]);

  useEffect(() => {
    if (!activeThread) return;
    setMode(activeThread.mode);
    setIncludeProject(activeThread.includeProject);
    if (activeThread.mode === "conversation" && activeThread.participants[0]) {
      setConversationResident(activeThread.participants[0]);
    } else if (activeThread.mode === "roundtable") {
      setRoundtableResidents(activeThread.participants);
    } else if (activeThread.mode === "challenge") {
      setChallengeLibrarian(activeThread.participants.includes("librarian"));
    }
  }, [activeThread?.id]);

  async function createDiscussion(): Promise<LivingRoomSnapshot | null> {
    if (openingRef.current) return null;
    openingRef.current = true;
    setOpening(true);
    setError(null);
    try {
      const next = await window.hearth.createLivingRoomDiscussion(
        mode,
        participants,
        includeProject
      );
      setSnapshot(next);
      onSnapshotChange(next);
      setActiveThreadId(next.activeThreadId);
      setConfirmArchive(false);
      return next;
    } catch {
      setError("The room couldn't open a new discussion. Nothing was lost.");
      return null;
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  }

  useEffect(() => {
    if (!snapshot.threads.length && !openingRef.current) {
      void createDiscussion();
    }
    // The empty room should quietly prepare one place to talk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.threads.length]);

  useEffect(() => {
    return window.hearth.onLivingRoomEvent((event: LivingRoomEvent) => {
      if (event.type === "started") {
        setBusy(true);
        setActiveThreadId(event.threadId);
        setSnapshot((current) => ({
          ...current,
          threads: current.threads.map((thread) =>
            thread.id === event.threadId
              ? {
                  ...thread,
                  mode: event.mode,
                  participants: event.participants,
                  messages: [
                    ...thread.messages.filter(
                      (entry) => !entry.id.startsWith("pending-")
                    ),
                    ...(thread.messages.some(
                      (entry) => entry.id === event.userMessage.id
                    )
                      ? []
                      : [event.userMessage])
                  ]
                }
              : thread
          )
        }));
      } else if (event.type === "resident_started") {
        setActiveAgent(event.agent);
        setActiveStage(event.stage);
        setStreamText("");
      } else if (event.type === "delta") {
        setStreamText((current) => current + event.text);
      } else if (event.type === "resident_completed") {
        setStreamText("");
        setSnapshot((current) => ({
          ...current,
          threads: current.threads.map((thread) =>
            thread.id === event.threadId &&
            !thread.messages.some((entry) => entry.id === event.message.id)
              ? { ...thread, messages: [...thread.messages, event.message] }
              : thread
          )
        }));
      } else {
        setSnapshot(event.snapshot);
        setBusy(false);
        setActiveAgent(null);
        setActiveStage("");
        setStreamText("");
      }
    });
  }, []);

  useEffect(() => {
    const list = messagesRef.current;
    if (!list || !followLatest) return;
    list.scrollTop = list.scrollHeight;
  }, [activeThread?.messages, followLatest, streamText]);

  function toggleRoundtable(agent: AgentKey): void {
    setRoundtableResidents((current) => {
      if (current.includes(agent)) {
        return current.length > 1
          ? current.filter((resident) => resident !== agent)
          : current;
      }
      return current.length < 4 ? [...current, agent] : current;
    });
  }

  async function send(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy || !participants.length) return;
    let threadId = activeThreadId;
    if (!threadId) {
      const created = await createDiscussion();
      threadId = created?.activeThreadId ?? null;
    }
    if (!threadId) return;
    const pending: LivingRoomMessage = {
      id: `pending-${crypto.randomUUID()}`,
      threadId,
      role: "user",
      agent: null,
      text,
      round: (activeThread?.messages.at(-1)?.round ?? 0) + 1,
      createdAt: new Date().toISOString()
    };
    setMessage("");
    setBusy(true);
    setError(null);
    setFollowLatest(true);
    setSnapshot((current) => ({
      ...current,
      threads: current.threads.map((thread) =>
        thread.id === threadId
          ? { ...thread, messages: [...thread.messages, pending] }
          : thread
      )
    }));
    try {
      const result = await window.hearth.sendLivingRoomMessage({
        threadId,
        text,
        mode,
        participants,
        includeProject
      });
      setSnapshot(result.snapshot);
      onSnapshotChange(result.snapshot);
    } catch {
      setSnapshot((current) => ({
        ...current,
        threads: current.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: thread.messages.filter((entry) => entry.id !== pending.id)
              }
            : thread
        )
      }));
      setMessage(text);
      setError("That message didn't make it through. It's back in the box so you can try again.");
    } finally {
      setBusy(false);
      setActiveAgent(null);
      setStreamText("");
    }
  }

  async function archiveDiscussion(): Promise<void> {
    if (!activeThreadId || busy) return;
    setError(null);
    try {
      const next = await window.hearth.archiveLivingRoomDiscussion(activeThreadId);
      setSnapshot(next);
      onSnapshotChange(next);
      setActiveThreadId(next.activeThreadId);
      setConfirmArchive(false);
    } catch {
      setError("That discussion couldn't be put away. It's still here.");
    }
  }

  async function restoreDiscussion(): Promise<void> {
    if (!activeThreadId || busy) return;
    setError(null);
    try {
      const next = await window.hearth.restoreLivingRoomDiscussion(activeThreadId);
      setSnapshot(next);
      onSnapshotChange(next);
      setShowArchived(false);
      setActiveThreadId(activeThreadId);
    } catch {
      setError("That discussion couldn't be brought back.");
    }
  }

  async function renameDiscussion(): Promise<void> {
    if (!activeThreadId || busy) return;
    const title = titleDraft.trim();
    if (!title) return;
    setError(null);
    try {
      const next = await window.hearth.renameLivingRoomDiscussion(activeThreadId, title);
      setSnapshot(next);
      onSnapshotChange(next);
      setRenaming(false);
    } catch {
      setError("That discussion couldn't be renamed.");
    }
  }

  return (
    <main className="room-content living-room">
      <header className="living-heading">
        <div>
          <p className="eyebrow">Living Room · shared household conversation</p>
          <h1>Pull up a chair.</h1>
          <p>Talk normally, gather a few perspectives, or let Maker and Critic properly fight it out.</p>
        </div>
        <div className="living-heading-actions">
          <span className="living-project-scope">
            {includeProject ? `Current project · ${data.workspace.selectedProject.name}` : "House only"}
          </span>
          <button type="button" onClick={() => void createDiscussion()} disabled={opening || busy}>
            {opening ? "Opening…" : "New discussion"}
          </button>
        </div>
      </header>

      <div className="living-thread-tools">
        <label>
          <span className="sr-only">Search Living Room discussions</span>
          <input value={threadSearch} onChange={(event) => setThreadSearch(event.target.value)} placeholder="Search discussions…" />
        </label>
        <button type="button" className={showArchived ? "is-active" : ""} onClick={() => {
          setShowArchived((current) => !current);
          setActiveThreadId(showArchived ? snapshot.activeThreadId : snapshot.archivedThreads[0]?.id ?? null);
        }}>
          {showArchived ? "Open discussions" : `Put away · ${snapshot.archivedThreads.length}`}
        </button>
      </div>

      <div className="living-thread-strip" aria-label={showArchived ? "Put-away Living Room discussions" : "Living Room discussions"}>
        {visibleThreads.map((thread) => (
          <button
            type="button"
            className={thread.id === activeThreadId ? "is-active" : ""}
            key={thread.id}
            onClick={() => setActiveThreadId(thread.id)}
          >
            <strong>{thread.title}</strong>
            <small>{modeCopy(thread.mode).label} · {thread.messages.length} messages</small>
          </button>
        ))}
        {!visibleThreads.length ? <p className="living-thread-empty">{threadSearch ? "Nothing here matches that search." : showArchived ? "No discussions have been put away." : "No open discussions."}</p> : null}
      </div>

      <div className="living-layout">
        <section className="living-conversation" aria-label="Shared household discussion">
          <header>
            <div>
              <p className="eyebrow">Shared transcript</p>
              {renaming && activeThread ? (
                <form className="living-title-editor" onSubmit={(event) => { event.preventDefault(); void renameDiscussion(); }}>
                  <input aria-label="Discussion title" value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} maxLength={120} autoFocus />
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setRenaming(false)}>Cancel</button>
                </form>
              ) : <h2>{activeThread?.title ?? "New discussion"}</h2>}
            </div>
            <div className="living-conversation-actions">
              {activeArchived ? (
                <button type="button" onClick={() => void restoreDiscussion()}>Bring back</button>
              ) : confirmArchive ? (
                <div className="living-archive-confirm">
                  <span>Put this discussion away?</span>
                  <button type="button" onClick={() => void archiveDiscussion()}>Put away</button>
                  <button type="button" onClick={() => setConfirmArchive(false)}>Keep</button>
                </div>
              ) : (
                <>
                  <button type="button" disabled={!activeThread || busy} onClick={() => {
                    setTitleDraft(activeThread?.title ?? "");
                    setRenaming(true);
                  }}>Rename</button>
                  <button type="button" disabled={!activeThread || busy} onClick={() => setConfirmArchive(true)}>Put away</button>
                </>
              )}
            </div>
          </header>

          <div
            className="living-messages"
            ref={messagesRef}
            onScroll={(event) => {
              const element = event.currentTarget;
              setFollowLatest(
                element.scrollHeight - element.scrollTop - element.clientHeight < 34
              );
            }}
          >
            {!activeThread?.messages.length && !busy ? (
              <div className="living-welcome">
                <CompanionFace />
                <div>
                  <strong>The room’s yours.</strong>
                  <p>Call one person, gather a few of us, or run a pressure test when you want real disagreement.</p>
                </div>
              </div>
            ) : null}
            {activeThread?.messages.map((entry) => (
              <article
                className={classNames(
                  "living-message",
                  entry.role === "user" && "is-user",
                  entry.role === "system" && "is-system",
                  entry.id.startsWith("pending-") && "is-pending"
                )}
                key={entry.id}
              >
                {entry.role === "resident" && entry.agent ? (
                  <LivingPortrait agent={entry.agent} />
                ) : null}
                <div>
                  <header>
                    <strong>{entry.role === "user" ? "You" : residentName(entry.agent)}</strong>
                    <span>{formatTime(entry.createdAt)}</span>
                    {!entry.id.startsWith("pending-") ? (
                      <button
                        type="button"
                        onClick={() => void window.hearth.writeClipboard(entry.text)}
                      >
                        Copy
                      </button>
                    ) : null}
                  </header>
                  <p>{entry.text}</p>
                </div>
              </article>
            ))}
            {busy && activeAgent ? (
              <article className="living-message is-streaming">
                <LivingPortrait agent={activeAgent} thinking />
                <div>
                  <header>
                    <strong>{residentName(activeAgent)}</strong>
                    <span>thinking</span>
                  </header>
                  <p>{streamText || activeStage}</p>
                </div>
              </article>
            ) : null}
          </div>
          {!followLatest ? (
            <button
              type="button"
              className="living-latest"
              onClick={() => {
                setFollowLatest(true);
                const list = messagesRef.current;
                if (list) list.scrollTop = list.scrollHeight;
              }}
            >
              Latest ↓
            </button>
          ) : null}

          {error ? <p className="living-error" role="status">{error}</p> : null}

          {!activeArchived && decisionHandoff ? (
            <div className="living-outcomes">
              <span>Use the latest household take</span>
              <button type="button" onClick={() => onDraftDecision(decisionHandoff, "study")}>Draft for Maker</button>
              <button type="button" onClick={() => onDraftDecision(decisionHandoff, "workshop")}>Take to Workshop</button>
              <button type="button" onClick={() => void onSaveDecision(decisionHandoff)}>Save as note</button>
            </div>
          ) : null}

          {!activeArchived ? <form className="living-composer" onSubmit={(event) => void send(event)}>
            <label className="sr-only" htmlFor="living-room-message">Talk to the room</label>
            <textarea
              id="living-room-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={submitOnEnter}
              placeholder={
                mode === "conversation"
                  ? `Talk to ${residentName(conversationResident)}…`
                  : mode === "roundtable"
                    ? "Give the room something to work through…"
                    : "What do you want properly pressure-tested?"
              }
              maxLength={8_000}
            />
            <footer>
              <div>
                <strong>{turnSequence}</strong>
                <span>{turnCount} resident {turnCount === 1 ? "turn" : "turns"} · Enter sends · Shift+Enter adds a line</span>
              </div>
              {busy ? (
                <button
                  type="button"
                  className="living-stop"
                  onClick={() => void window.hearth.cancelLivingRoomDiscussion()}
                >
                  Stop discussion
                </button>
              ) : (
                <button type="submit" disabled={!message.trim() || !activeThreadId}>
                  Send ↑
                </button>
              )}
            </footer>
          </form> : <div className="living-archived-note">This discussion is put away. Bring it back before continuing it.</div>}
        </section>

        <aside className="living-household">
          {activeThread?.context ? (
            <section className="living-context-card">
              <p className="eyebrow">Brought into the room</p>
              <strong>{activeThread.context.label}</strong>
              <p>{activeThread.context.summary}</p>
              <small>Visible to everyone called into this discussion. Private chats and terminal output stay out.</small>
            </section>
          ) : null}
          <div className="living-mode-picker">
            <p className="eyebrow">How should we talk?</p>
            {(["conversation", "roundtable", "challenge"] as const).map((value) => {
              const copy = modeCopy(value);
              return (
                <button
                  type="button"
                  className={mode === value ? "is-active" : ""}
                  key={value}
                  onClick={() => setMode(value)}
                  disabled={busy}
                >
                  <strong>{copy.label}</strong>
                  <small>{copy.detail}</small>
                </button>
              );
            })}
          </div>

          <div className="living-residents">
            <div className="living-resident-heading">
              <p className="eyebrow">In the room</p>
              <span>{turnCount} called</span>
            </div>
            {RESIDENTS.map((resident) => {
              const selected = participants.includes(resident.id);
              const locked =
                mode === "challenge" && resident.id !== "librarian";
              return (
                <button
                  type="button"
                  className={classNames(
                    "living-resident",
                    selected && "is-selected",
                    locked && "is-locked"
                  )}
                  key={resident.id}
                  disabled={busy || locked}
                  onClick={() => {
                    if (mode === "conversation") {
                      setConversationResident(resident.id);
                    } else if (mode === "roundtable") {
                      toggleRoundtable(resident.id);
                    } else if (resident.id === "librarian") {
                      setChallengeLibrarian((current) => !current);
                    }
                  }}
                >
                  <LivingPortrait
                    agent={resident.id}
                    thinking={busy && activeAgent === resident.id}
                  />
                  <span>
                    <strong>{resident.name}</strong>
                    <small>{resident.role}</small>
                    <em>{providerLabel(data, resident.id)}</em>
                  </span>
                  <i aria-hidden="true">{selected ? "✓" : "+"}</i>
                </button>
              );
            })}
          </div>

          <label className="living-project-toggle">
            <input
              type="checkbox"
              checked={includeProject}
              disabled={busy}
              onChange={(event) => setIncludeProject(event.target.checked)}
            />
            <span>
              <strong>Bring in the current project</strong>
              <small>
                {includeProject
                  ? `${data.workspace.selectedProject.name} summary is visible. No terminal output.`
                  : "House conversation only. No project or terminal context."}
              </small>
            </span>
          </label>
        </aside>
      </div>
    </main>
  );
}
