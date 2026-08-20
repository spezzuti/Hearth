import {
  lazy,
  Suspense,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  AgentContext,
  AgentContextKind,
  AgentKey,
  AgentMessageUpdate,
  AgentProviderSelection,
  AgentSurface,
  AgentStreamEvent,
  ArchiveKind,
  ArchiveRemovalResult,
  BootstrapData,
  CapturePatch,
  CaptureRecord,
  CaptureSaveResult,
  CompanionAccessStatus,
  CompanionRemoteAccessStatus,
  ConversationMessage,
  ContextAgent,
  DesktopNotificationStatus,
  IdeaPromotionResult,
  IdeaPromotionTarget,
  LibraryCapturePage,
  LibraryDiscoveryFeedback,
  LibraryShelf,
  LibrarySort,
  LivingRoomContext,
  LivingRoomSnapshot,
  MakerPermissionRequest,
  MakerSessionControl,
  MakerSessionState,
  WorkshopTurnHealth,
  WorkshopTurnUsage,
  WorkshopContextManifest,
  MakerWorkPlanEntry,
  MakerWorkActivity,
  NotificationPreferences,
  PersonalOsStacksImportResult,
  PersonalOsStacksPreview,
  ProjectState,
  ReasoningAgent,
  ReturnPack,
  Room,
  TerminalKind,
  TerminalOwner,
  TerminalSession,
  TerminalSnapshot,
  WorkspaceCatalog,
  WorkspaceProjectSummary
} from "../../shared/contracts";
import {
  HearthSearch,
  type HearthSearchResult
} from "./HearthSearch";
import { HouseMemoryDialog } from "./HouseMemoryDialog";
import { ResidentAvatar } from "./ResidentAvatar";
import { residentProviderLabel } from "./provider-label";
import { LivingRoom } from "./LivingRoom";
import { ReferenceCard } from "./ReferenceCard";
import {
  CompanionCharacter,
  type CompanionMood,
  companionFrameSources
} from "./CompanionCharacter";

interface AgentStreamView {
  requestId: string;
  text: string;
}

const WorkshopRoom = lazy(async () => {
  const module = await import("./WorkshopRoom");
  return { default: module.WorkshopRoom };
});

const ProjectSurface = lazy(async () => {
  const module = await import("./ProjectSurface");
  return { default: module.ProjectSurface };
});

const ArchiveRoom = lazy(async () => {
  const module = await import("./ArchiveRoom");
  return { default: module.ArchiveRoom };
});

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function relativeAge(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "unknown";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : formatDate(value);
}

function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function submitChatOnEnter(event: KeyboardEvent<HTMLTextAreaElement>): void {
  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

function agentProviderLabel(data: BootstrapData, agent: ReasoningAgent): string {
  const resident = data.runtime.provider.residents?.[agent];
  if (resident) {
    return residentProviderLabel(resident);
  }
  if (data.runtime.provider.active === "local") {
    return data.runtime.provider.name;
  }
  return (
    data.runtime.provider.models[agent] ??
    (agent === "critic" ? "Codex" : "Claude configured Opus")
  );
}

function householdProviderLabel(data: BootstrapData): string {
  if (data.runtime.provider.selection === "local") {
    return data.runtime.provider.name;
  }
  const maker = agentProviderLabel(data, "maker").replace(/^Claude /, "");
  const critic = agentProviderLabel(data, "critic").replace(/^Claude /, "");
  return `${maker} · ${critic}`;
}

interface IconProps {
  children: ReactNode;
  tone?: "light" | "dark" | "copper" | "blue";
}

function RoomIcon({ children, tone = "dark" }: IconProps): ReactNode {
  return <span className={`room-icon room-icon--${tone}`}>{children}</span>;
}

function Sidebar({
  route,
  onNavigate,
  liveProcesses
}: {
  route: Room;
  onNavigate: (route: Room) => void;
  liveProcesses: number;
}): ReactNode {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <span>H</span>
          <i />
        </div>
        <div>
          <strong>Hearth</strong>
          <small>working home</small>
        </div>
      </div>

      <nav className="room-nav" aria-label="Rooms">
        <p className="nav-label">Rooms</p>
        <button
          className={classNames("room-link", route === "home" && "is-active")}
          onClick={() => onNavigate("home")}
          aria-current={route === "home" ? "page" : undefined}
        >
          <RoomIcon tone="light">⌂</RoomIcon>
          <span>
            <strong>Home</strong>
            <small>Orient & return</small>
          </span>
        </button>
        <button
          className={classNames("room-link", route === "living" && "is-active")}
          onClick={() => onNavigate("living")}
          aria-current={route === "living" ? "page" : undefined}
        >
          <RoomIcon tone="copper">R</RoomIcon>
          <span>
            <strong>Living Room</strong>
            <small>Discuss & decide</small>
          </span>
        </button>
        <button
          className={classNames("room-link", route === "study" && "is-active")}
          onClick={() => onNavigate("study")}
          aria-current={route === "study" ? "page" : undefined}
        >
          <RoomIcon tone="copper">S</RoomIcon>
          <span>
            <strong>Study</strong>
            <small>Direct & review</small>
          </span>
        </button>
        <button
          className={classNames("room-link", route === "workshop" && "is-active")}
          onClick={() => onNavigate("workshop")}
          aria-current={route === "workshop" ? "page" : undefined}
        >
          <RoomIcon tone="blue">W</RoomIcon>
          <span>
            <strong>Workshop</strong>
            <small>Run & collaborate</small>
          </span>
        </button>
        <button
          className={classNames("room-link", route === "library" && "is-active")}
          onClick={() => onNavigate("library")}
          aria-current={route === "library" ? "page" : undefined}
        >
          <RoomIcon>L</RoomIcon>
          <span>
            <strong>Library</strong>
            <small>Keep & discover</small>
          </span>
        </button>
        <button
          className={classNames("room-link", route === "studio" && "is-active")}
          onClick={() => onNavigate("studio")}
          aria-current={route === "studio" ? "page" : undefined}
        >
          <RoomIcon tone="copper">✦</RoomIcon>
          <span>
            <strong>Studio</strong>
            <small>Explore & decide</small>
          </span>
        </button>
        <button
          className={classNames("room-link", route === "archive" && "is-active")}
          onClick={() => onNavigate("archive")}
          aria-current={route === "archive" ? "page" : undefined}
        >
          <RoomIcon>A</RoomIcon>
          <span>
            <strong>Archive</strong>
            <small>Remember & recover</small>
          </span>
        </button>
      </nav>

      <div className="sidebar-status">
        <div className="status-line">
          <span className="status-dot" />
          <div>
            <strong>Core steady</strong>
            <small>SQLite · WAL</small>
          </div>
        </div>
        <div className="quiet-line">
          <span>{liveProcesses > 0 ? "Workshop live" : "Quiet mode"}</span>
          <strong>{liveProcesses} running</strong>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  projectName,
  onProject,
  onCapture,
  onSearch,
  onLeave
}: {
  projectName: string;
  onProject: () => void;
  onCapture: (text: string) => Promise<unknown>;
  onSearch: () => void;
  onLeave: () => void;
}): ReactNode {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = text.trim();
    if (!value || saving) {
      return;
    }
    setSaving(true);
    try {
      await onCapture(value);
      setText("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="topbar">
      <button
        className="project-switcher"
        type="button"
        aria-label="Choose current project"
        title="Choose a project in Study"
        onClick={onProject}
      >
        <span className="project-glyph">H</span>
        <span>
          <small>Current project · change</small>
          <strong>{projectName}</strong>
        </span>
        <i aria-hidden="true">→</i>
      </button>

      <form className="capture-bar" onSubmit={(event) => void submit(event)}>
        <span className="capture-plus" aria-hidden="true">＋</span>
        <label className="sr-only" htmlFor="universal-capture">
          Save a link, thought, or idea
        </label>
        <input
          id="universal-capture"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Drop something… @idea · @note · #tag"
          maxLength={12_000}
        />
        <span className="capture-hint">{saving ? "Saving…" : "Enter to keep"}</span>
        <button
          className="capture-find"
          type="button"
          onClick={onSearch}
          aria-label="Search Hearth"
          title="Search Hearth · Ctrl+K"
        >
          <span aria-hidden="true">⌕</span>
          Find
        </button>
      </form>

      <button className="leave-button" type="button" onClick={onLeave}>
        <span aria-hidden="true">☾</span>
        Leave well
      </button>
    </header>
  );
}

function ReturnPackCard({
  pack,
  nextAction,
  onContinue,
  continueLabel = "Continue in Study"
}: {
  pack: ReturnPack;
  nextAction: string;
  onContinue: () => void;
  continueLabel?: string;
}): ReactNode {
  return (
    <section className="return-card" aria-labelledby="return-pack-title">
      <div className="return-card__header">
        <div>
          <p className="eyebrow">Your return pack</p>
          <h2 id="return-pack-title">Where you left off</h2>
        </div>
        <span className="saved-time">Saved {formatDate(pack.createdAt)}</span>
      </div>

      <p className="return-summary">{pack.whereYouLeftOff}</p>

      <div className="truth-grid">
        <div className="truth-item">
          <span className="truth-icon truth-icon--green" aria-hidden="true">●</span>
          <div>
            <small>Actual session state</small>
            <p>{pack.sessionState}</p>
          </div>
        </div>
        <div className="truth-item">
          <span className="truth-icon truth-icon--blue" aria-hidden="true">✓</span>
          <div>
            <small>Last approved action</small>
            <p>{pack.lastApprovedAction}</p>
          </div>
        </div>
        <div className="truth-item">
          <span className="truth-icon truth-icon--gold" aria-hidden="true">→</span>
          <div>
            <small>Waiting on you</small>
            <p>{pack.waitingOnYou}</p>
          </div>
        </div>
      </div>

      <div className="next-action">
        <div>
          <small>Recommended next action</small>
          <strong>{nextAction}</strong>
        </div>
        <button className="primary-button" onClick={onContinue}>
          {continueLabel} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

function HomeRoom({
  data,
  onNavigate,
  historicalPack,
  onCloseHistoricalPack,
  houseMemoryOpenRequest,
  onHouseMemoryOpenRequestHandled,
  onHouseMemoryChange,
  onNotify,
  onGather
}: {
  data: BootstrapData;
  onNavigate: (route: Room) => void;
  historicalPack: ReturnPack | null;
  onCloseHistoricalPack: () => void;
  houseMemoryOpenRequest: number;
  onHouseMemoryOpenRequestHandled: () => void;
  onHouseMemoryChange: (houseMemory: BootstrapData["houseMemory"]) => void;
  onNotify: (message: string) => void;
  onGather: () => void;
}): ReactNode {
  const [companionAccess, setCompanionAccess] =
    useState<CompanionAccessStatus | null>(null);
  const [companionRemote, setCompanionRemote] =
    useState<CompanionRemoteAccessStatus | null>(null);
  const [notificationStatus, setNotificationStatus] =
    useState<DesktopNotificationStatus | null>(null);
  const [companionBusy, setCompanionBusy] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [attentionControlsOpen, setAttentionControlsOpen] = useState(false);
  const [houseMemoryOpen, setHouseMemoryOpen] = useState(false);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
    new Date()
  );
  const returnToWorkshop = Boolean(
    data.terminal.session &&
    (["starting", "running", "waiting"].includes(data.terminal.session.lifecycle) ||
      (data.terminal.session.kind === "claude" &&
        data.terminal.session.claudeSessionId &&
        data.terminal.session.claudeResumable))
  );

  useEffect(() => {
    void Promise.all([
      window.hearth.getCompanionAccess(),
      window.hearth.getCompanionRemoteAccess(),
      window.hearth.getNotificationStatus()
    ]).then(([local, remote, notifications]) => {
      setCompanionAccess(local);
      setCompanionRemote(remote);
      setNotificationStatus(notifications);
    });
  }, []);

  useEffect(() => {
    if (houseMemoryOpenRequest > 0) {
      setHouseMemoryOpen(true);
      onHouseMemoryOpenRequestHandled();
    }
  }, [houseMemoryOpenRequest, onHouseMemoryOpenRequestHandled]);

  async function updateNotifications(
    key: keyof NotificationPreferences
  ): Promise<void> {
    if (!notificationStatus || notificationBusy) return;
    setNotificationBusy(true);
    try {
      const status = await window.hearth.setNotificationPreferences({
        ...notificationStatus.preferences,
        [key]: !notificationStatus.preferences[key]
      });
      setNotificationStatus(status);
      onNotify("Quiet Windows attention preferences were updated.");
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "Windows attention preferences could not change."
      );
    } finally {
      setNotificationBusy(false);
    }
  }

  async function toggleCompanion(): Promise<void> {
    if (!companionAccess || companionBusy) return;
    setCompanionBusy(true);
    try {
      const status = await window.hearth.setCompanionAccess(
        !companionAccess.enabled
      );
      setCompanionAccess(status);
      setCompanionRemote(await window.hearth.getCompanionRemoteAccess());
      onNotify(
        status.enabled
          ? "Companion access is on for this Hearth session."
          : "Companion access is off."
      );
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "Companion access could not change."
      );
    } finally {
      setCompanionBusy(false);
    }
  }

  async function toggleRemoteCompanion(): Promise<void> {
    if (!companionRemote || companionBusy) return;
    setCompanionBusy(true);
    try {
      const status = await window.hearth.setCompanionRemoteAccess(
        companionRemote.state !== "active"
      );
      setCompanionRemote(status);
      onNotify(
        status.state === "active"
          ? "Companion is available on your private Tailscale network."
          : "Private Companion access is off."
      );
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "Private Companion access could not change."
      );
    } finally {
      setCompanionBusy(false);
    }
  }

  async function rotatePairing(): Promise<void> {
    setCompanionBusy(true);
    try {
      setCompanionAccess(await window.hearth.rotateCompanionPairing());
      onNotify("Old Companion sessions were revoked. A fresh code is ready.");
    } catch (reason) {
      onNotify(
        reason instanceof Error ? reason.message : "Pairing could not be refreshed."
      );
    } finally {
      setCompanionBusy(false);
    }
  }
  return (
    <main className="room-content home-room">
      <div className="room-heading">
        <div>
          <p className="eyebrow">{weekday} · Hearth is quiet</p>
          <h1>Welcome home.</h1>
          <p>
            One project is active. Nothing needs your attention before you’re ready.
          </p>
        </div>
        <div className="ambient-weather" aria-label="System state">
          <span className="ambient-orb" />
          <div>
            <strong>{data.runtime.liveProcesses > 0 ? "Workshop live" : "Clear"}</strong>
            <small>
              {data.runtime.liveProcesses > 0
                ? `${data.runtime.liveProcesses} session running quietly`
                : "No blockers · no live processes"}
            </small>
          </div>
        </div>
      </div>

      {historicalPack ? (
        <section className="home-orientation-note" aria-label="Historical Return Pack">
          <div>
            <strong>Looking at a saved return point</strong>
            <p>
              This is reference only. The current project, terminal, and household
              context shown elsewhere on Home have not been rolled back.
            </p>
          </div>
          <button type="button" onClick={onCloseHistoricalPack}>
            Back to latest
          </button>
        </section>
      ) : null}

      <ReturnPackCard
        pack={historicalPack ?? data.returnPack}
        nextAction={
          historicalPack?.recommendedNextAction ?? data.state.nextAction
        }
        onContinue={() =>
          onNavigate(
            historicalPack
              ? "study"
              : returnToWorkshop
                ? "workshop"
                : "study"
          )
        }
        continueLabel={
          historicalPack
            ? "Open current Study"
            : returnToWorkshop
              ? "Return to Workshop"
              : "Continue in Study"
        }
      />

      <div className="home-columns">
        <section className="panel current-project-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Current project</p>
              <h2>{data.workspace.selectedProject.name}</h2>
            </div>
            <span className="project-state">Active</span>
          </div>
          <p className="objective-copy">
            {data.workspace.selectedProject.rootPath === data.project.rootPath
              ? data.state.objective
              : "Ready for review and a new Workshop session. A project-specific brief has not been created yet."}
          </p>
          <div className="project-facts">
            <div>
              <small>Root</small>
              <strong>{data.workspace.selectedProject.rootPath}</strong>
            </div>
            <div>
              <small>Provider</small>
              <strong>{householdProviderLabel(data)}</strong>
            </div>
            <div>
              <small>Processes</small>
              <strong>{data.runtime.liveProcesses} live</strong>
            </div>
          </div>
          <button className="text-button" onClick={() => onNavigate("study")}>
            Open project room <span aria-hidden="true">→</span>
          </button>
        </section>

        <section className="panel household-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">The household</p>
              <h2>Available when called</h2>
            </div>
            <div className="household-heading-actions">
              <button
                className="household-gather"
                type="button"
                onClick={onGather}
              >
                Gather everyone
              </button>
              <span className="quiet-badge">quiet</span>
              <button
                className="house-memory-open"
                type="button"
                onClick={() => setHouseMemoryOpen(true)}
              >
                Memory
                <strong>{data.houseMemory.active.length}</strong>
                {data.houseMemory.suggested.length ? (
                  <i aria-label={`${data.houseMemory.suggested.length} practice suggestions`} />
                ) : null}
              </button>
            </div>
          </div>
          <div className="household-list">
            <div className="household-member">
              <ResidentAvatar resident="maker" mood="present" />
              <div>
                <strong>Maker</strong>
                <small>In Study · ready to talk</small>
              </div>
              <span className="member-state">available</span>
            </div>
            <div className="household-member">
              <ResidentAvatar resident="librarian" mood="present" />
              <div>
                <strong>Librarian</strong>
                <small>In Library · ready to talk</small>
              </div>
              <span className="member-state">available</span>
            </div>
            <div className="household-member">
              <ResidentAvatar resident="critic" />
              <div>
                <strong>Critic</strong>
                <small>In Study · reviews handoffs</small>
              </div>
              <span className="member-state">available</span>
            </div>
          </div>
        </section>
      </div>

      <div className="home-columns home-columns--lower">
        <section className="panel keeps-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Recently kept</p>
              <h2>Captures</h2>
            </div>
            <span>{data.captures.length} here</span>
          </div>
          {data.captures.length === 0 ? (
            <div className="empty-state">
              <span aria-hidden="true">⌁</span>
              <p>Anything dropped into the bar above will wait here without becoming a task.</p>
            </div>
          ) : (
            <div className="capture-list">
              {data.captures.slice(0, 4).map((capture) => (
                <div className="capture-row" key={capture.id}>
                  <span className={`capture-kind capture-kind--${capture.kind}`}>
                    {capture.kind === "link" ? "↗" : capture.kind === "idea" ? "✦" : "•"}
                  </span>
                  <div>
                    <strong>{capture.text}</strong>
                    <small>{capture.kind} · {formatTime(capture.createdAt)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel companion-access-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Away from the desk</p>
              <h2>Companion access</h2>
            </div>
            <span
              className={classNames(
                "quiet-badge",
                companionAccess?.enabled && "is-ready"
              )}
            >
              {companionRemote?.state === "active"
                ? "private"
                : companionAccess?.enabled
                  ? "local"
                  : "off"}
            </span>
          </div>
          <p className="companion-access-copy">
            A smaller phone-friendly Hearth for status, captures, reports, and
            Companion chat. No terminal, files, or execution controls.
          </p>
          {companionAccess?.enabled ? (
            <div className="companion-access-live">
              <div>
                <small>Open on this PC</small>
                <strong>{companionAccess.localUrl}</strong>
              </div>
              <div>
                <small>Temporary pairing code</small>
                <strong className="pairing-code">
                  {companionAccess.pairingCode ?? "Already paired"}
                </strong>
              </div>
              <div className="companion-private-state">
                <small>Private phone access</small>
                <strong>
                  {companionRemote?.state === "active"
                    ? companionRemote.remoteUrl
                    : companionRemote?.state === "available"
                      ? "Tailscale is ready"
                      : "Not connected"}
                </strong>
              </div>
              <p>{companionAccess.detail}</p>
              {companionRemote ? (
                <p className="companion-remote-detail">
                  {companionRemote.detail}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="companion-access-boundary">
              {companionRemote?.state === "active"
                ? "The private address is still reserved, but Hearth is not serving anything. You can remove that route here."
                : "Off by default. Turn it on here before choosing whether to keep it on this PC or share it with your private Tailscale devices."}
            </p>
          )}
          <div className="companion-access-actions">
            <button
              type="button"
              className="small-button"
              disabled={!companionAccess || companionBusy}
              onClick={() => void toggleCompanion()}
            >
              {companionBusy
                ? "Working…"
                : companionAccess?.enabled
                  ? "Turn off"
                  : "Turn on locally"}
            </button>
            {companionAccess?.enabled ? (
              <>
                <button
                  type="button"
                  className="small-button small-button--quiet"
                  onClick={() =>
                    companionAccess.localUrl &&
                    void window.hearth.openExternal(companionAccess.localUrl)
                  }
                >
                  Open
                </button>
                <button
                  type="button"
                  className="small-button small-button--quiet"
                  disabled={companionBusy}
                  onClick={() => void rotatePairing()}
                >
                  New code
                </button>
                {companionRemote?.state === "available" ? (
                  <button
                    type="button"
                    className="small-button"
                    disabled={companionBusy}
                    onClick={() => void toggleRemoteCompanion()}
                  >
                    Share privately
                  </button>
                ) : null}
                {companionRemote?.state === "active" ? (
                  <>
                    <button
                      type="button"
                      className="small-button small-button--quiet"
                      onClick={() =>
                        companionRemote.remoteUrl &&
                        void window.hearth.openExternal(
                          companionRemote.remoteUrl
                        )
                      }
                    >
                      Open private
                    </button>
                    <button
                      type="button"
                      className="small-button small-button--quiet"
                      disabled={companionBusy}
                      onClick={() => void toggleRemoteCompanion()}
                    >
                      Stop sharing
                    </button>
                  </>
                ) : null}
              </>
            ) : null}
            {!companionAccess?.enabled &&
            companionRemote?.state === "active" ? (
              <button
                type="button"
                className="small-button small-button--quiet"
                disabled={companionBusy}
                onClick={() => void toggleRemoteCompanion()}
              >
                Remove private route
              </button>
            ) : null}
            <button
              type="button"
              className="small-button small-button--quiet companion-attention-toggle"
              aria-expanded={attentionControlsOpen}
              aria-controls="companion-attention-controls"
              onClick={() => setAttentionControlsOpen((open) => !open)}
            >
              Alerts
              <span aria-hidden="true">⌄</span>
            </button>
          </div>
          {attentionControlsOpen ? (
            <div className="quiet-alerts" id="companion-attention-controls">
              <div className="quiet-alerts-heading">
                <div>
                  <small>Windows attention</small>
                  <strong>Only while Hearth is minimized</strong>
                </div>
                <span>
                  {notificationStatus?.supported === false
                    ? "Unavailable"
                    : "Quiet"}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={
                  notificationStatus?.preferences.workshopAttention ?? true
                }
                disabled={
                  !notificationStatus ||
                  !notificationStatus.supported ||
                  notificationBusy
                }
                className={classNames(
                  "quiet-alert-toggle",
                  notificationStatus?.preferences.workshopAttention && "is-on"
                )}
                onClick={() => void updateNotifications("workshopAttention")}
              >
                <span>
                  <strong>Workshop needs me</strong>
                  <small>One silent alert when Claude Code is waiting.</small>
                </span>
                <i aria-hidden="true" />
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={
                  notificationStatus?.preferences.residentReplies ?? true
                }
                disabled={
                  !notificationStatus ||
                  !notificationStatus.supported ||
                  notificationBusy
                }
                className={classNames(
                  "quiet-alert-toggle",
                  notificationStatus?.preferences.residentReplies && "is-on"
                )}
                onClick={() => void updateNotifications("residentReplies")}
              >
                <span>
                  <strong>Residents finish answering</strong>
                  <small>Maker, Librarian, Critic, and Companion replies.</small>
                </span>
                <i aria-hidden="true" />
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={
                  notificationStatus?.preferences.phoneActivity ?? false
                }
                disabled={
                  !notificationStatus ||
                  !notificationStatus.supported ||
                  notificationBusy
                }
                className={classNames(
                  "quiet-alert-toggle",
                  notificationStatus?.preferences.phoneActivity && "is-on"
                )}
                onClick={() => void updateNotifications("phoneActivity")}
              >
                <span>
                  <strong>Phone activity</strong>
                  <small>Captures and idea decisions, never chat noise.</small>
                </span>
                <i aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </section>
      </div>
      {houseMemoryOpen ? (
        <HouseMemoryDialog
          snapshot={data.houseMemory}
          selectedProject={data.workspace.selectedProject}
          onChange={onHouseMemoryChange}
          onClose={() => setHouseMemoryOpen(false)}
          onNotify={onNotify}
        />
      ) : null}
    </main>
  );
}

function captureIsPutAway(item: CaptureRecord): boolean {
  return item.kind === "idea" ? item.ideaState === "let-go" : item.archived;
}

function LibraryRoom({
  data,
  onSend,
  onCapture,
  onUpdate,
  onEnrich,
  onRefreshDiscovery,
  onDiscoveryFeedback,
  onImportPersonalOsStacks,
  onCancel,
  onNotify,
  focusCaptureId,
  onGather
}: {
  data: BootstrapData;
  onSend: (
    agent: AgentKey,
    text: string,
    surface?: AgentSurface,
    libraryCaptureId?: string
  ) => Promise<boolean>;
  onCapture: (text: string) => Promise<CaptureSaveResult>;
  onUpdate: (captureId: string, patch: CapturePatch) => Promise<void>;
  onEnrich: (captureId: string) => Promise<void>;
  onRefreshDiscovery: (force: boolean) => Promise<void>;
  onDiscoveryFeedback: (
    discoveryId: string,
    feedback: LibraryDiscoveryFeedback
  ) => Promise<void>;
  onImportPersonalOsStacks: () => Promise<PersonalOsStacksImportResult>;
  onCancel: () => Promise<void>;
  onNotify: (message: string) => void;
  focusCaptureId?: string | null;
  onGather: (item: CaptureRecord) => void;
}): ReactNode {
  const [query, setQuery] = useState("");
  const [shelf, setShelf] = useState<LibraryShelf>("all");
  const [sort, setSort] = useState<LibrarySort>("saved");
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [surface, setSurface] = useState<"collection" | "discover">("collection");
  const [discoveryKind, setDiscoveryKind] = useState<
    "all" | "dependable" | "emerging" | "skill" | "dismissed"
  >("all");
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const librarianMessagesRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editCollection, setEditCollection] = useState("");
  const [itemBusy, setItemBusy] = useState<string | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const [stacksPreview, setStacksPreview] =
    useState<PersonalOsStacksPreview | null>(null);
  const [stacksOpen, setStacksOpen] = useState(false);
  const [stacksBusy, setStacksBusy] = useState(false);
  const [catalogPage, setCatalogPage] = useState<LibraryCapturePage | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const catalogRequestRef = useRef(0);
  const [librarianItem, setLibrarianItem] = useState<CaptureRecord | null>(null);
  const librarianComposerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!focusCaptureId) return;
    const focused = data.captures.find((item) => item.id === focusCaptureId);
    if (!focused || focused.kind !== "link") return;
    setSurface("collection");
    setQuery("");
    setShelf(focused.archived ? "archive" : "all");
    setCollectionFilter(null);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-library-id="${focusCaptureId}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [data.captures, focusCaptureId]);

  useEffect(() => {
    void onRefreshDiscovery(false);
    void window.hearth
      .inspectPersonalOsStacks()
      .then((preview) => {
        setStacksPreview(preview);
        if (!preview.newCount && preview.organizationCount) {
          setStacksOpen(true);
        }
      })
      .catch(() => undefined);
    // Opening the room checks the six-hour cache; it does not force network traffic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function importStacks(): Promise<void> {
    if (
      stacksBusy ||
      !(stacksPreview?.newCount || stacksPreview?.organizationCount)
    ) return;
    setStacksBusy(true);
    try {
      const result = await onImportPersonalOsStacks();
      setStacksPreview(result.preview);
      if (!result.preview.newCount && !result.preview.organizationCount) {
        setStacksOpen(false);
      }
    } finally {
      setStacksBusy(false);
    }
  }

  async function loadCatalog(offset = 0, append = false): Promise<void> {
    const requestId = ++catalogRequestRef.current;
    setCatalogBusy(true);
    setCatalogError(null);
    try {
      const page = await window.hearth.listLibraryCaptures({
        query,
        shelf,
        collection: collectionFilter,
        sort,
        offset,
        limit: 48
      });
      if (catalogRequestRef.current !== requestId) return;
      setCatalogPage((current) =>
        append && current
          ? { ...page, items: [...current.items, ...page.items], offset: 0 }
          : page
      );
    } catch (reason) {
      if (catalogRequestRef.current !== requestId) return;
      setCatalogError(
        reason instanceof Error
          ? reason.message
          : "The catalog could not be opened."
      );
    } finally {
      if (catalogRequestRef.current === requestId) setCatalogBusy(false);
    }
  }

  useEffect(() => {
    if (surface !== "collection") return;
    const timer = window.setTimeout(() => void loadCatalog(), 120);
    return () => window.clearTimeout(timer);
    // Capture changes are the refresh signal after saves, filing, and archive moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionFilter, data.captures, query, shelf, sort, surface]);

  const collectionOptions = useMemo(
    () =>
      [...new Set(
        [
          ...(catalogPage?.collections.map((item) => item.name) ?? []),
          ...data.captures
          .filter(
            (item) => item.kind === "link" && item.libraryCollection
          )
          .map((item) => item.libraryCollection as string)
        ]
      )].sort((left, right) => left.localeCompare(right)),
    [catalogPage?.collections, data.captures]
  );

  const collectionShelves = useMemo(() => {
    const eligible = data.captures.filter((item) => {
      if (item.kind !== "link") return false;
      const putAway = captureIsPutAway(item);
      if (shelf === "archive") return putAway;
      if (putAway) return false;
      return shelf !== "pinned" || item.pinned;
    });
    const counts = new Map<string, number>();
    let unfiled = 0;
    for (const item of eligible) {
      if (item.libraryCollection) {
        counts.set(
          item.libraryCollection,
          (counts.get(item.libraryCollection) ?? 0) + 1
        );
      } else {
        unfiled += 1;
      }
    }
    return {
      collections: [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      unfiled
    };
  }, [data.captures, shelf]);

  const fallbackItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return data.captures.filter(
      (item) => {
        if (item.kind !== "link") return false;
        const putAway = captureIsPutAway(item);
        return (
          (shelf === "archive"
            ? putAway
            : !putAway &&
            (shelf === "all" ||
              (shelf === "pinned" && item.pinned))) &&
          (collectionFilter === null ||
            (collectionFilter === ""
              ? !item.libraryCollection
              : item.libraryCollection === collectionFilter)) &&
          (!needle ||
            `${item.title ?? ""} ${item.description ?? ""} ${item.text} ${item.domain ?? ""} ${item.libraryCollection ?? ""} ${item.projectName ?? ""} ${item.tags.join(" ")}`
              .toLocaleLowerCase()
              .includes(needle))
        );
      }
    );
  }, [collectionFilter, data.captures, query, shelf]);
  const items = catalogPage?.items ?? fallbackItems;
  const catalogTotal = catalogPage?.total ?? items.length;
  const activeLibraryCount =
    catalogPage?.activeCount ??
    data.captures.filter(
      (item) => item.kind === "link" && !captureIsPutAway(item)
    ).length;

  const savedDiscoveryUrls = useMemo(
    () =>
      new Set(
        data.captures
          .filter((item) => item.kind === "link")
          .map((item) => item.text.toLocaleLowerCase().replace(/\/$/, ""))
      ),
    [data.captures]
  );

  const discoveries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return data.libraryDiscovery.items.filter(
      (item) => {
        const saved = savedDiscoveryUrls.has(
          item.url.toLocaleLowerCase().replace(/\/$/, "")
        );
        const laneMatches =
          discoveryKind === "all" ||
          (discoveryKind === "dependable" &&
            item.kind === "repo" &&
            !item.emerging) ||
          (discoveryKind === "emerging" &&
            item.kind === "repo" &&
            item.emerging) ||
          (discoveryKind === "skill" && item.kind === "skill");
        return (
          (discoveryKind === "dismissed"
            ? item.feedback === "dismissed"
            : item.feedback !== "dismissed" && !saved && laneMatches) &&
        (!needle ||
          `${item.name} ${item.description ?? ""} ${item.language ?? ""} ${item.topics.join(" ")}`
            .toLocaleLowerCase()
              .includes(needle))
        );
      }
    );
  }, [
    data.libraryDiscovery.items,
    discoveryKind,
    query,
    savedDiscoveryUrls
  ]);

  function beginEdit(item: CaptureRecord): void {
    setEditing(item.id);
    setEditTitle(item.title ?? "");
    setEditDescription(item.description ?? "");
    setEditTags(item.tags.join(", "));
    setEditCollection(item.libraryCollection ?? "");
  }

  async function saveEdit(item: CaptureRecord): Promise<void> {
    setItemBusy(item.id);
    try {
      await onUpdate(item.id, {
        title: editTitle || null,
        description: editDescription || null,
        libraryCollection: editCollection || null,
        tags: editTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      });
      setEditing(null);
    } finally {
      setItemBusy(null);
    }
  }

  async function updateItem(item: CaptureRecord, patch: CapturePatch): Promise<void> {
    setItemBusy(item.id);
    try {
      await onUpdate(item.id, patch);
    } finally {
      setItemBusy(null);
    }
  }

  async function enrich(item: CaptureRecord): Promise<void> {
    setItemBusy(item.id);
    try {
      await onEnrich(item.id);
    } finally {
      setItemBusy(null);
    }
  }

  async function refreshDiscovery(): Promise<void> {
    if (discoveryBusy) return;
    setDiscoveryBusy(true);
    try {
      await onRefreshDiscovery(true);
    } finally {
      setDiscoveryBusy(false);
    }
  }

  async function setFeedback(
    discoveryId: string,
    feedback: LibraryDiscoveryFeedback
  ): Promise<void> {
    setFeedbackBusy(discoveryId);
    try {
      await onDiscoveryFeedback(discoveryId, feedback);
    } finally {
      setFeedbackBusy(null);
    }
  }

  async function ask(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const completed = await onSend(
        "librarian",
        text,
        "resident",
        librarianItem?.id
      );
      if (!completed) setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const messageList = librarianMessagesRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
    messageList.scrollLeft = 0;
  }, [data.conversations.librarian, busy]);

  return (
    <main className="room-content library-room">
      <header className="library-heading">
        <div>
          <p className="eyebrow">Library · things worth keeping</p>
          <h1>A useful shelf, not a link graveyard.</h1>
          <p>Keep the good material tidy, or browse a fresh shelf shaped by the project you’re actually working on.</p>
        </div>
        <div className="library-count">
          <strong>{activeLibraryCount}</strong>
          <span>active items</span>
        </div>
      </header>
      <div className="library-layout">
        <section className="library-catalog">
          <div className="library-tools">
            <div className="library-tool-heading">
              <div className="library-surface-tabs">
                <button
                  className={surface === "collection" ? "is-active" : ""}
                  type="button"
                  onClick={() => setSurface("collection")}
                >
                  Your collection
                </button>
                <button
                  className={surface === "discover" ? "is-active" : ""}
                  type="button"
                  onClick={() => setSurface("discover")}
                >
                  Discover
                  {data.libraryDiscovery.items.length ? (
                    <span>{data.libraryDiscovery.items.length}</span>
                  ) : null}
                </button>
              </div>
              {stacksPreview?.state === "ready" &&
              stacksPreview.availableCount ? (
                <button
                  className={`library-stacks-button${stacksPreview.newCount || stacksPreview.organizationCount ? "" : " is-current"}`}
                  type="button"
                  aria-expanded={stacksOpen}
                  onClick={() => setStacksOpen((current) => !current)}
                >
                  <span>PersonalOS Stacks</span>
                  <strong>
                    {stacksPreview.newCount
                      ? `${stacksPreview.newCount} new`
                      : stacksPreview.organizationCount
                        ? `${stacksPreview.organizationCount} to file`
                        : "Current"}
                  </strong>
                </button>
              ) : null}
            </div>
            <div className="library-search-row">
              <input
                aria-label="Search Library"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  surface === "collection"
                    ? "Search titles, collections, tags, domains, or projects…"
                    : "Search current recommendations…"
                }
              />
              {surface === "discover" ? (
                <button
                  className="library-refresh"
                  type="button"
                  onClick={() => void refreshDiscovery()}
                  disabled={discoveryBusy}
                >
                  {discoveryBusy ? "Refreshing…" : "Refresh shelf"}
                </button>
              ) : (
                <label className="library-sort">
                  <span>Sort</span>
                  <select
                    aria-label="Sort Library"
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as LibrarySort)
                    }
                  >
                    <option value="saved">Recently saved</option>
                    <option value="updated">Recently updated</option>
                    <option value="title">Title</option>
                    <option value="collection">Collection</option>
                  </select>
                </label>
              )}
            </div>
            <div className="library-filters" aria-label="Library shelves">
              {(surface === "collection"
                ? (["all", "pinned", "archive"] as const)
                : ([
                    "all",
                    "dependable",
                    "emerging",
                    "skill",
                    "dismissed"
                  ] as const)
              ).map((value) => (
                <button
                  className={
                    (surface === "collection" ? shelf : discoveryKind) === value
                      ? "is-active"
                      : ""
                  }
                  type="button"
                  key={value}
                  onClick={() => {
                    if (surface === "collection") {
                      setShelf(value as LibraryShelf);
                      setCollectionFilter(null);
                    }
                    else setDiscoveryKind(
                      value as
                        | "all"
                        | "dependable"
                        | "emerging"
                        | "skill"
                        | "dismissed"
                    );
                  }}
                >
                  {value === "all"
                    ? surface === "collection" ? "Everything" : "Curated"
                    : value === "archive"
                      ? "Put away"
                      : value === "dependable"
                        ? "Dependable"
                        : value === "emerging"
                          ? "Emerging"
                        : value === "dismissed"
                          ? "Hidden"
                        : `${value.charAt(0).toUpperCase()}${value.slice(1)}${value === "pinned" ? "" : "s"}`}
                  {surface === "collection" && catalogPage ? (
                    <strong>
                      {value === "all"
                        ? catalogPage.activeCount
                        : value === "pinned"
                          ? catalogPage.pinnedCount
                          : catalogPage.archivedCount}
                    </strong>
                  ) : null}
                </button>
              ))}
            </div>
            {surface === "discover" ? (
              <div className="library-discovery-status" role="status">
                <span>
                  <strong>
                    {data.libraryDiscovery.state === "stale"
                      ? "Last good shelf"
                      : "Current shelf"}
                  </strong>
                  {data.libraryDiscovery.refreshedAt
                    ? ` · refreshed ${relativeAge(data.libraryDiscovery.refreshedAt)}`
                    : " · not refreshed yet"}
                </span>
                <small>
                  {discoveries.length} shown · shaped by Hearth and what you keep
                </small>
              </div>
            ) : null}
            {surface === "collection" ? (
              <div
                className="library-collection-shelves"
                aria-label="Library collections"
              >
                <span>Collections</span>
                <button
                  className={collectionFilter === null ? "is-active" : ""}
                  type="button"
                  onClick={() => setCollectionFilter(null)}
                >
                  All
                </button>
                {(catalogPage?.collections ?? collectionShelves.collections).map((collection) => (
                  <button
                    className={
                      collectionFilter === collection.name ? "is-active" : ""
                    }
                    type="button"
                    key={collection.name}
                    onClick={() => setCollectionFilter(collection.name)}
                  >
                    {collection.name} <strong>{collection.count}</strong>
                  </button>
                ))}
                {(catalogPage?.unfiledCount ?? collectionShelves.unfiled) ? (
                  <button
                    className={
                      collectionFilter === "" ? "is-active" : ""
                    }
                    type="button"
                    onClick={() => setCollectionFilter("")}
                  >
                    Needs filing <strong>{catalogPage?.unfiledCount ?? collectionShelves.unfiled}</strong>
                  </button>
                ) : null}
              </div>
            ) : null}
            {surface === "collection" ? (
              <div className="library-catalog-status" role="status">
                <span>
                  {catalogBusy && !catalogPage
                    ? "Opening the catalog…"
                    : `${items.length} of ${catalogTotal} shown`}
                </span>
                {catalogError ? (
                  <button type="button" onClick={() => void loadCatalog()}>
                    Try again
                  </button>
                ) : (
                  <small>
                    {collectionFilter === ""
                      ? "These are waiting for a collection."
                      : "Search covers the full Library, not just what is on screen."}
                  </small>
                )}
              </div>
            ) : null}
            {stacksOpen && stacksPreview?.state === "ready" ? (
              <aside
                className="library-stacks-import"
                aria-label="PersonalOS Stacks import"
              >
                <header>
                  <div>
                    <p className="eyebrow">From the old library</p>
                    <h2>
                      {stacksPreview.newCount
                        ? "Bring over PersonalOS Stacks"
                        : stacksPreview.organizationCount
                          ? "Restore the Stacks collections"
                          : "PersonalOS Stacks"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Close PersonalOS Stacks review"
                    onClick={() => setStacksOpen(false)}
                  >
                    ×
                  </button>
                </header>
                <p>
                  {stacksPreview.message} PersonalOS stays read-only, and links
                  you released there stay behind.
                </p>
                {stacksPreview.collections.length ? (
                  <div className="library-stacks-collections">
                    {stacksPreview.collections.map((collection) => (
                      <span key={collection.name}>
                        {collection.name} <strong>{collection.count}</strong>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="library-stacks-list">
                  {stacksPreview.items.map((item) => (
                    <div key={item.id}>
                      <span aria-hidden="true">
                        {item.alreadyInLibrary ? "✓" : "↳"}
                      </span>
                      <p>
                        <strong>{item.title ?? item.domain}</strong>
                        <small>
                          {item.domain}
                          {item.collection ? ` · ${item.collection}` : " · Unfiled"}
                        </small>
                      </p>
                      <em>
                        {item.needsCollection
                          ? "Needs filing"
                          : item.alreadyInLibrary
                            ? "Already here"
                            : "Ready"}
                      </em>
                    </div>
                  ))}
                </div>
                <footer>
                  <small>
                    Collections stay separate from tags and project connections.
                    Running this again only brings over or files what is missing.
                  </small>
                  {stacksPreview.newCount || stacksPreview.organizationCount ? (
                    <button
                      className="small-button"
                      type="button"
                      disabled={stacksBusy}
                      onClick={() => void importStacks()}
                    >
                      {stacksBusy
                        ? "Bringing them over…"
                        : stacksPreview.newCount
                          ? `Bring over ${stacksPreview.newCount}`
                          : `File ${stacksPreview.organizationCount}`}
                    </button>
                  ) : (
                    <span className="library-stacks-complete">
                      Everything organized
                    </span>
                  )}
                </footer>
              </aside>
            ) : null}
          </div>
          <div className="library-grid">
            {surface === "collection" && items.length ? items.map((item) => (
              <article
                className={classNames(
                  "library-item",
                  `library-item--${item.kind}`,
                  item.pinned && "is-pinned",
                  captureIsPutAway(item) && "is-archived",
                  focusCaptureId === item.id && "is-focused",
                  editing === item.id && "is-editing"
                )}
                data-library-id={item.id}
                key={item.id}
              >
                <div className="library-item-meta">
                  <span>
                    {item.pinned ? "Pinned" : item.kind}
                    {item.domain ? ` · ${item.domain}` : ""}
                  </span>
                  <small>{formatDate(item.updatedAt)}</small>
                </div>
                {editing === item.id ? (
                  <div className="library-item-editor">
                    <label>
                      Name
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        placeholder={item.domain ?? "A useful name"}
                      />
                    </label>
                    <label>
                      Note
                      <textarea
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                        placeholder="Why this is worth keeping…"
                      />
                    </label>
                    <label>
                      Tags
                      <input
                        value={editTags}
                        onChange={(event) => setEditTags(event.target.value)}
                        placeholder="terminal, agents, reference"
                      />
                    </label>
                    <label>
                      Collection
                      <input
                        value={editCollection}
                        onChange={(event) =>
                          setEditCollection(event.target.value)
                        }
                        list="library-collection-options"
                        maxLength={80}
                        placeholder="Unfiled"
                      />
                    </label>
                    <datalist id="library-collection-options">
                      {collectionOptions.map((collection) => (
                        <option value={collection} key={collection} />
                      ))}
                    </datalist>
                    <div>
                      <button
                        type="button"
                        onClick={() => void saveEdit(item)}
                        disabled={itemBusy === item.id}
                      >
                        Save
                      </button>
                      <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="library-item-page">
                      <h2>{item.title ?? item.domain ?? item.text.slice(0, 80)}</h2>
                      {item.reference ? (
                        <ReferenceCard
                          reference={item.reference}
                          compact
                          onOpen={() => void window.hearth.openExternal(item.reference!.canonicalUrl)}
                        />
                      ) : null}
                      <p className="library-item-copy">
                        {item.description ?? item.text}
                      </p>
                      {item.tags.length ? (
                        <div className="library-tags">
                          {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      ) : null}
                    </div>
                    <footer>
                      <span>
                        {item.libraryCollection ?? "Unfiled"}
                        {item.projectName
                          ? ` · Connected to ${item.projectName}`
                          : ""}
                      </span>
                      <div className="library-item-actions">
                        {item.kind === "link" ? (
                          <>
                            <button type="button" onClick={() => void window.hearth.openExternal(item.text)}>
                              Open ↗
                            </button>
                            <button
                              type="button"
                              onClick={() => void enrich(item)}
                              disabled={itemBusy === item.id}
                            >
                              {item.metadataFetchedAt ? "Refresh details" : "Read details"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLibrarianItem(item);
                                window.requestAnimationFrame(() =>
                                  librarianComposerRef.current?.focus()
                                );
                              }}
                            >
                              Discuss
                            </button>
                            <button type="button" onClick={() => onGather(item)}>
                              Gather
                            </button>
                          </>
                        ) : null}
                        <button type="button" onClick={() => beginEdit(item)}>Edit</button>
                        {!captureIsPutAway(item) ? (
                          <button
                            type="button"
                            onClick={() => void updateItem(item, { pinned: !item.pinned })}
                            disabled={itemBusy === item.id}
                          >
                            {item.pinned ? "Unpin" : "Pin"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            const putAway = captureIsPutAway(item);
                            void updateItem(
                              item,
                              item.kind === "idea"
                                ? {
                                    ideaState: putAway ? "resting" : "let-go",
                                    ...(putAway ? {} : { pinned: false })
                                  }
                                : {
                                    archived: !putAway,
                                    ...(putAway ? {} : { pinned: false })
                                  }
                            );
                          }}
                          disabled={itemBusy === item.id}
                        >
                          {captureIsPutAway(item)
                            ? item.kind === "idea"
                              ? "Bring back"
                              : "Restore"
                            : item.kind === "idea"
                              ? "Let go"
                              : "Put away"}
                        </button>
                      </div>
                    </footer>
                  </>
                )}
              </article>
            )) : surface === "discover" && discoveries.length ? discoveries.map((item) => {
              const saved = data.captures.some(
                (capture) =>
                  capture.kind === "link" &&
                  capture.text.toLocaleLowerCase().replace(/\/$/, "") ===
                    item.url.toLocaleLowerCase().replace(/\/$/, "")
              );
              return (
                <article
                  className={classNames(
                    "library-item",
                    "library-discovery-item",
                    item.emerging && "is-emerging",
                    item.feedback === "dismissed" && "is-dismissed"
                  )}
                  key={item.id}
                >
                  <div className="library-item-meta">
                    <span>
                      {item.kind === "skill"
                        ? item.emerging
                          ? "Emerging skill"
                          : "Skill collection"
                        : item.emerging
                          ? "Emerging"
                          : "Dependable"}
                    </span>
                    <small>{item.stars.toLocaleString()} ★</small>
                  </div>
                  <h2>{item.name}</h2>
                  <p className="library-item-copy">
                    {item.description ?? "No sales pitch supplied. Inspect the repository before deciding."}
                  </p>
                  <p className="library-discovery-reason">{item.reason}</p>
                  <div className="library-tags">
                    {item.language ? <span>{item.language}</span> : null}
                    {item.topics.slice(0, 3).map((topic) => <span key={topic}>{topic}</span>)}
                  </div>
                  <footer>
                    <span>Updated {relativeAge(item.pushedAt)}</span>
                    <div className="library-item-actions">
                      <button type="button" onClick={() => void window.hearth.openExternal(item.url)}>
                        Inspect ↗
                      </button>
                      {item.feedback !== "dismissed" ? (
                        <button
                          type="button"
                          disabled={saved || feedbackBusy === item.id}
                          onClick={() => {
                            void onCapture(item.url)
                              .then(async (result) => {
                                if (result.duplicate) return;
                                await onUpdate(result.capture.id, {
                                  title: item.name,
                                  description: item.description,
                                  libraryCollection:
                                    item.kind === "skill"
                                      ? "Skills"
                                      : "Repositories",
                                  tags: [
                                    item.kind,
                                    ...(item.language ? [item.language] : []),
                                    ...(item.emerging ? ["emerging"] : [])
                                  ]
                                });
                                await onDiscoveryFeedback(item.id, "kept");
                              })
                              .catch(() =>
                                onNotify("That recommendation could not be saved.")
                              );
                          }}
                        >
                          {saved ? "On your shelf" : "Keep"}
                        </button>
                      ) : null}
                      {item.feedback === "dismissed" ? (
                        <button
                          type="button"
                          disabled={feedbackBusy === item.id}
                          onClick={() => void setFeedback(item.id, "none")}
                        >
                          Put back
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={feedbackBusy === item.id}
                          onClick={() => void setFeedback(item.id, "dismissed")}
                        >
                          Not for me
                        </button>
                      )}
                    </div>
                  </footer>
                </article>
              );
            }) : (
              <div className="library-empty">
                <strong>
                  {surface === "discover" && data.libraryDiscovery.state === "stale"
                    ? "The fresh shelf is out of reach."
                    : "No shelf matches that."}
                </strong>
                <p>
                  {surface === "discover"
                    ? data.libraryDiscovery.message
                    : "Try a looser word, another shelf, or ask Librarian in plain language."}
                </p>
                {surface === "discover" ? (
                    <button
                      type="button"
                      className="small-button"
                      onClick={() => void refreshDiscovery()}
                      disabled={discoveryBusy}
                    >
                      {discoveryBusy ? "Looking…" : "Look for current work"}
                    </button>
                ) : null}
              </div>
            )}
            {surface === "collection" && catalogPage?.hasMore ? (
              <div className="library-load-more">
                <button
                  className="small-button"
                  type="button"
                  disabled={catalogBusy}
                  onClick={() => void loadCatalog(items.length, true)}
                >
                  {catalogBusy
                    ? "Opening more…"
                    : `Show more · ${catalogTotal - items.length} remaining`}
                </button>
              </div>
            ) : null}
          </div>
        </section>
        <aside className="librarian-rail">
          <header>
            <ResidentAvatar resident="librarian" mood={busy ? "thinking" : "present"} />
            <div>
              <p className="eyebrow">At the desk</p>
              <h2>Librarian</h2>
              <small className="librarian-provider">
                {agentProviderLabel(data, "librarian")}
              </small>
            </div>
          </header>
          <div
            className="librarian-messages"
            ref={librarianMessagesRef}
            aria-live="polite"
          >
            {data.conversations.librarian.slice(-40).map((item) => (
              <article
                className={classNames(
                  item.role === "user" && "is-user",
                  item.id.startsWith("pending-") && "is-pending"
                )}
                key={item.id}
              >
                <strong>{item.role === "user" ? "You" : "Librarian"}</strong>
                <p>{item.text}</p>
              </article>
            ))}
            {!data.conversations.librarian.length ? (
              <div className="librarian-welcome">
                <strong>Looking for something?</strong>
                <p>Tell me what you remember about it. The wording doesn’t have to be exact.</p>
              </div>
            ) : null}
          </div>
          <form onSubmit={(event) => void ask(event)}>
            <label htmlFor="librarian-message">Ask Librarian</label>
            {librarianItem ? (
              <div className="librarian-item-context">
                <span>
                  Talking about <strong>{librarianItem.title ?? librarianItem.domain ?? "this item"}</strong>
                </span>
                <button
                  type="button"
                  aria-label="Stop discussing this Library item"
                  onClick={() => setLibrarianItem(null)}
                >
                  ×
                </button>
              </div>
            ) : null}
            <textarea
              ref={librarianComposerRef}
              id="librarian-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={submitChatOnEnter}
              placeholder="I saved something about terminal agents…"
            />
            <button
              className="small-button"
              type={busy ? "button" : "submit"}
              disabled={!busy && !message.trim()}
              onClick={busy ? () => void onCancel() : undefined}
            >
              {busy ? "Stop" : "Ask"}
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}

type StudioView = "resting" | "pursuing" | "let-go" | "all";

function cleanIdeaText(text: string): string {
  return text.replace(/^\s*idea\s*:\s*/i, "").trim();
}

function conciseIdeaTitle(item: CaptureRecord): string {
  if (item.title) return item.title;
  const text = cleanIdeaText(item.text);
  return text.length > 110 ? `${text.slice(0, 107).trimEnd()}…` : text;
}

function validWindowsProjectName(value: string): boolean {
  const name = value.trim();
  return Boolean(
    name &&
    name.length <= 80 &&
    name !== "." &&
    name !== ".." &&
    !/[<>:"/\\|?*\u0000-\u001f]/.test(name) &&
    !/[. ]$/.test(name) &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
  );
}

function suggestedProjectName(item: CaptureRecord): string {
  const suggestion = conciseIdeaTitle(item)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, 80)
    .replace(/[. ]+$/, "");
  return suggestion || "New Project";
}

type NoteView = "all" | "loose" | "connected" | "archive";

function StudioNotes({
  data,
  onCapture,
  onUpdate,
  onOpenProject,
  focusCaptureId
}: {
  data: BootstrapData;
  onCapture: (
    text: string,
    kind?: CaptureRecord["kind"]
  ) => Promise<CaptureSaveResult>;
  onUpdate: (captureId: string, patch: CapturePatch) => Promise<void>;
  onOpenProject: (project: WorkspaceProjectSummary) => Promise<void>;
  focusCaptureId?: string | null;
}): ReactNode {
  const [view, setView] = useState<NoteView>("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [projectId, setProjectId] = useState("");
  const [catalog, setCatalog] = useState<WorkspaceCatalog | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => {
    void window.hearth
      .listWorkspaceProjects()
      .then(setCatalog)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!focusCaptureId) return;
    const focused = data.captures.find((item) => item.id === focusCaptureId);
    if (!focused || focused.kind !== "note") return;
    setQuery("");
    setView(focused.archived ? "archive" : "all");
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-note-id="${focusCaptureId}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [data.captures, focusCaptureId]);

  const notes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return data.captures
      .filter((item) => {
        if (item.kind !== "note") return false;
        if (view === "archive" ? !item.archived : item.archived) return false;
        if (view === "loose" && item.workspaceProjectId) return false;
        if (view === "connected" && !item.workspaceProjectId) return false;
        return (
          !needle ||
          `${item.title ?? ""} ${item.description ?? ""} ${item.text} ${item.projectName ?? ""} ${item.tags.join(" ")}`
            .toLocaleLowerCase()
            .includes(needle)
        );
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [data.captures, query, view]);

  async function saveNote(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = draft.trim();
    if (!text || saving) return;
    const project = catalog?.projects.find((item) => item.id === projectId);
    const projectMention = project ? `@"${project.name}" ` : "";
    setSaving(true);
    try {
      await onCapture(`@note ${projectMention}${text}`, "note");
      setDraft("");
      setView(project ? "connected" : "loose");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(item: CaptureRecord): void {
    setEditing(item.id);
    setEditTitle(item.title ?? "");
    setEditDescription(item.description ?? "");
    setEditTags(item.tags.join(", "));
  }

  async function saveEdit(item: CaptureRecord): Promise<void> {
    setBusyId(item.id);
    try {
      await onUpdate(item.id, {
        title: editTitle || null,
        description: editDescription || null,
        tags: editTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      });
      setEditing(null);
    } finally {
      setBusyId(null);
    }
  }

  async function setArchived(item: CaptureRecord, archived: boolean): Promise<void> {
    setBusyId(item.id);
    try {
      await onUpdate(item.id, { archived, ...(archived ? { pinned: false } : {}) });
    } finally {
      setBusyId(null);
    }
  }

  async function makeLoose(item: CaptureRecord): Promise<void> {
    setBusyId(item.id);
    try {
      await onUpdate(item.id, { workspaceProjectId: null });
      setView("loose");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="studio-note-workspace">
      <form className="studio-note-capture" onSubmit={(event) => void saveNote(event)}>
        <div>
          <p className="eyebrow">Notebook</p>
          <label htmlFor="studio-note">New note</label>
          <span>Keep it loose, or attach it to a project now.</span>
        </div>
        <textarea
          id="studio-note"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={submitChatOnEnter}
          placeholder="Something worth remembering, without turning it into an idea…"
          maxLength={12_000}
        />
        <div className="studio-note-destination">
          <label htmlFor="studio-note-project">Belongs with</label>
          <select
            id="studio-note-project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">Loose notes</option>
            {catalog?.projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button className="primary-button" disabled={!draft.trim() || saving}>
            {saving ? "Keeping…" : "Keep note"}
          </button>
        </div>
      </form>

      <section className="studio-note-shelf" aria-labelledby="studio-notes-title">
        <header>
          <div>
            <p className="eyebrow">Notes</p>
            <h2 id="studio-notes-title">
              {view === "loose"
                ? "Loose notes"
                : view === "connected"
                  ? "Connected notes"
                  : view === "archive"
                    ? "Put away"
                    : "Everything"}
            </h2>
          </div>
          <input
            aria-label="Search notes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search words, tags, or projects…"
          />
          <div className="studio-note-tabs" role="tablist" aria-label="Note location">
            {([
              ["all", "Everything"],
              ["loose", "Loose"],
              ["connected", "Connected"],
              ["archive", "Put away"]
            ] as const).map(([value, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={view === value}
                className={view === value ? "is-active" : ""}
                onClick={() => setView(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="studio-note-grid">
          {notes.length ? (
            notes.map((item) => {
              const project = catalog?.projects.find(
                (candidate) => candidate.id === item.workspaceProjectId
              );
              return (
                <article
                  className={classNames(
                    "studio-note-card",
                    item.archived && "is-archived",
                    focusCaptureId === item.id && "is-focused"
                  )}
                  data-note-id={item.id}
                  key={item.id}
                >
                  <header>
                    <span>{item.workspaceProjectId ? "Connected note" : "Loose note"}</span>
                    <small>{formatDate(item.updatedAt)}</small>
                  </header>
                  {editing === item.id ? (
                    <div className="studio-note-editor">
                      <label>
                        Title
                        <input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          placeholder="Optional title"
                        />
                      </label>
                      <label>
                        Context
                        <textarea
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                          placeholder="Why this matters…"
                        />
                      </label>
                      <label>
                        Tags
                        <input
                          value={editTags}
                          onChange={(event) => setEditTags(event.target.value)}
                          placeholder="ui, terminal, follow-up"
                        />
                      </label>
                      <div>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void saveEdit(item)}
                        >
                          Save
                        </button>
                        <button type="button" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {item.title ? <h3>{item.title}</h3> : null}
                      <p>{item.text}</p>
                      {item.description ? <blockquote>{item.description}</blockquote> : null}
                      {item.tags.length ? (
                        <div className="studio-note-tags">
                          {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      ) : null}
                      <footer>
                        <span>{item.projectName ?? "Not attached yet"}</span>
                        <div>
                          {project ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void onOpenProject(project)}
                              >
                                Open project
                              </button>
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={() => void makeLoose(item)}
                              >
                                Remove from project
                              </button>
                            </>
                          ) : null}
                          <button type="button" onClick={() => beginEdit(item)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void setArchived(item, !item.archived)}
                          >
                            {item.archived ? "Restore" : "Put away"}
                          </button>
                        </div>
                      </footer>
                    </>
                  )}
                </article>
              );
            })
          ) : (
            <div className="studio-note-empty">
              <strong>No notes match this shelf.</strong>
              <p>
                Notes stay searchable even when they are loose or put away.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StudioRoom({
  data,
  onCapture,
  onUpdate,
  onIdeaMessage,
  onPromote,
  onOpenProject,
  onCancelMaker,
  onNotify,
  makerStream,
  focusCaptureId
}: {
  data: BootstrapData;
  onCapture: (
    text: string,
    kind?: CaptureRecord["kind"]
  ) => Promise<CaptureSaveResult>;
  onUpdate: (captureId: string, patch: CapturePatch) => Promise<void>;
  onIdeaMessage: (
    captureId: string,
    text: string
  ) => Promise<AgentMessageUpdate>;
  onPromote: (
    captureId: string,
    target: IdeaPromotionTarget
  ) => Promise<IdeaPromotionResult>;
  onOpenProject: (project: WorkspaceProjectSummary) => Promise<void>;
  onCancelMaker: () => Promise<void>;
  onNotify: (message: string) => void;
  makerStream: AgentStreamView | null;
  focusCaptureId?: string | null;
}): ReactNode {
  const [surface, setSurface] = useState<"ideas" | "notes">(
    data.captures.some(
      (item) => item.id === focusCaptureId && item.kind === "note"
    )
      ? "notes"
      : "ideas"
  );
  const [view, setView] = useState<StudioView>("resting");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [ideaBusy, setIdeaBusy] = useState<string | null>(null);
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null);
  const [dialogView, setDialogView] = useState<"discuss" | "promote">("discuss");
  const [ideaMessages, setIdeaMessages] = useState<ConversationMessage[]>([]);
  const [ideaMessage, setIdeaMessage] = useState("");
  const [ideaSending, setIdeaSending] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [catalog, setCatalog] = useState<WorkspaceCatalog | null>(null);
  const [promotionMode, setPromotionMode] = useState<"existing" | "new">("existing");
  const [promotionProjectId, setPromotionProjectId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [promotionBusy, setPromotionBusy] = useState(false);
  const [promotionResult, setPromotionResult] = useState<IdeaPromotionResult | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const ideas = useMemo(
    () =>
      data.captures
        .filter((item) => item.kind === "idea" && !item.archived)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [data.captures]
  );
  const counts = {
    resting: ideas.filter((item) => item.ideaState === "resting").length,
    pursuing: ideas.filter((item) => item.ideaState === "pursuing").length,
    "let-go": ideas.filter((item) => item.ideaState === "let-go").length
  };
  const visibleIdeas =
    view === "all"
      ? ideas
      : ideas.filter((item) => (item.ideaState ?? "resting") === view);
  const activeIdea = ideas.find((item) => item.id === activeIdeaId) ?? null;
  const newProjectNameValid = validWindowsProjectName(newProjectName);

  useEffect(() => {
    if (!focusCaptureId) return;
    const focused = data.captures.find((item) => item.id === focusCaptureId);
    if (!focused) return;
    if (focused.kind === "note") {
      setSurface("notes");
      return;
    }
    if (focused.kind === "idea") {
      setSurface("ideas");
      setView(focused.ideaState ?? "resting");
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-idea-id="${focusCaptureId}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
  }, [data.captures, focusCaptureId]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
    list.scrollLeft = 0;
  }, [ideaMessages, ideaSending, makerStream?.text]);

  async function saveIdea(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await onCapture(text, "idea");
      setDraft("");
      setView("resting");
    } finally {
      setSaving(false);
    }
  }

  async function moveIdea(
    item: CaptureRecord,
    ideaState: NonNullable<CaptureRecord["ideaState"]>
  ): Promise<void> {
    setIdeaBusy(item.id);
    try {
      await onUpdate(item.id, { ideaState });
    } finally {
      setIdeaBusy(null);
    }
  }

  async function openIdea(
    item: CaptureRecord,
    nextView: "discuss" | "promote"
  ): Promise<void> {
    setActiveIdeaId(item.id);
    setDialogView(nextView);
    setPromotionResult(null);
    setNewProjectName(suggestedProjectName(item));
    setConversationLoading(true);
    try {
      const [messages, projects] = await Promise.all([
        window.hearth.getIdeaConversation(item.id),
        window.hearth.listWorkspaceProjects()
      ]);
      setIdeaMessages(messages);
      setCatalog(projects);
      const preferred =
        item.workspaceProjectId &&
        projects.projects.some((project) => project.id === item.workspaceProjectId)
          ? item.workspaceProjectId
          : projects.selectedProject.id;
      setPromotionProjectId(preferred);
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "That idea could not be opened."
      );
      setActiveIdeaId(null);
    } finally {
      setConversationLoading(false);
    }
  }

  function closeIdea(): void {
    if (ideaSending || promotionBusy) return;
    setActiveIdeaId(null);
    setIdeaMessage("");
    setPromotionResult(null);
  }

  async function discussIdea(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!activeIdea || ideaSending) return;
    const text = ideaMessage.trim();
    if (!text) return;
    const optimistic: ConversationMessage = {
      id: `pending-${crypto.randomUUID()}`,
      agent: "maker",
      role: "user",
      text,
      createdAt: new Date().toISOString()
    };
    setIdeaMessage("");
    setIdeaMessages((current) => [...current, optimistic]);
    setIdeaSending(true);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    try {
      const update = await onIdeaMessage(activeIdea.id, text);
      setIdeaMessages(update.messages);
      if (update.cancelled) setIdeaMessage(text);
    } catch (reason) {
      setIdeaMessages((current) =>
        current.filter((message) => message.id !== optimistic.id)
      );
      setIdeaMessage(text);
      onNotify(
        reason instanceof Error
          ? reason.message
          : "Maker could not join the Studio conversation."
      );
    } finally {
      setIdeaSending(false);
    }
  }

  async function promoteIdea(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!activeIdea || promotionBusy) return;
    const target: IdeaPromotionTarget =
      promotionMode === "existing"
        ? { kind: "existing", projectId: promotionProjectId }
        : { kind: "new", name: newProjectName.trim() };
    if (
      (target.kind === "existing" && !target.projectId) ||
      (target.kind === "new" && !target.name)
    ) {
      return;
    }
    setPromotionBusy(true);
    try {
      const result = await onPromote(activeIdea.id, target);
      setPromotionResult(result);
      setCatalog(await window.hearth.listWorkspaceProjects(true));
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "That idea could not become a project."
      );
    } finally {
      setPromotionBusy(false);
    }
  }

  const emptyCopy =
    view === "resting"
      ? {
          title: "Nothing is waiting on you.",
          body: "Drop an idea above when one arrives. Resting is a valid state."
        }
      : view === "pursuing"
        ? {
            title: "Nothing is in motion yet.",
            body: "Pursue an idea only when it earns your attention."
          }
        : view === "let-go"
          ? {
              title: "Nothing has been ruled out.",
              body: "Ideas you let go remain recoverable here."
            }
          : {
              title: "The Studio is quiet.",
              body: "Ideas captured here will have room to develop without becoming tasks."
            };

  const surfaceSwitcher = (
    <div className="studio-surface-switcher" role="tablist" aria-label="Studio surface">
      <button
        type="button"
        role="tab"
        aria-selected={surface === "ideas"}
        className={surface === "ideas" ? "is-active" : ""}
        onClick={() => setSurface("ideas")}
      >
        Ideas
        <span>{ideas.filter((item) => item.ideaState !== "let-go").length}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={surface === "notes"}
        className={surface === "notes" ? "is-active" : ""}
        onClick={() => setSurface("notes")}
      >
        Notes
        <span>{data.captures.filter((item) => item.kind === "note" && !item.archived).length}</span>
      </button>
    </div>
  );

  if (surface === "notes") {
    return (
      <main className="room-content studio-room studio-room--notes">
        <header className="studio-heading">
          <div>
            <p className="eyebrow">Studio · notes with somewhere to belong</p>
            <h1>Keep the thought close to its context.</h1>
            <p>
              Loose notes can wait here. Connected notes travel with the project they
              describe, and none of them need to clutter the Library.
            </p>
          </div>
          {surfaceSwitcher}
        </header>
        <StudioNotes
          data={data}
          onCapture={onCapture}
          onUpdate={onUpdate}
          onOpenProject={onOpenProject}
          focusCaptureId={focusCaptureId}
        />
      </main>
    );
  }

  return (
    <main className="room-content studio-room">
      <header className="studio-heading">
        <div>
          <p className="eyebrow">Studio · ideas with room to breathe</p>
          <h1>Let an idea rest before it asks anything of you.</h1>
          <p>
            Keep the strange ones, move the useful ones, and let repeated dead ends go
            without deleting the history.
          </p>
        </div>
        <div className="studio-heading-aside">
          {surfaceSwitcher}
          <div className="studio-counts" aria-label="Idea counts">
            <span><strong>{counts.resting}</strong> resting</span>
            <span><strong>{counts.pursuing}</strong> pursuing</span>
            <span><strong>{counts["let-go"]}</strong> let go</span>
          </div>
        </div>
      </header>

      <div className="studio-layout">
        <section className="studio-worktable" aria-labelledby="studio-ideas-title">
          <form className="studio-capture" onSubmit={(event) => void saveIdea(event)}>
            <div>
              <p className="eyebrow">Put something down</p>
              <label htmlFor="studio-idea">New idea</label>
            </div>
            <textarea
              id="studio-idea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={submitChatOnEnter}
              placeholder="A tool, a project, a weird possibility…"
              maxLength={12_000}
            />
            <div>
              <span>It starts at rest. Shift + Enter for a new line.</span>
              <button className="primary-button" disabled={!draft.trim() || saving}>
                {saving ? "Saving…" : "Let it rest"}
              </button>
            </div>
          </form>

          <div className="studio-shelf-heading">
            <div>
              <p className="eyebrow">Idea shelf</p>
              <h2 id="studio-ideas-title">
                {view === "resting"
                  ? "Resting"
                  : view === "pursuing"
                    ? "Pursuing"
                    : view === "let-go"
                      ? "Let go"
                      : "Everything"}
              </h2>
            </div>
            <div className="studio-tabs" role="tablist" aria-label="Idea state">
              {([
                ["resting", "Resting"],
                ["pursuing", "Pursuing"],
                ["let-go", "Let go"],
                ["all", "All"]
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={view === value}
                  className={view === value ? "is-active" : ""}
                  onClick={() => setView(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="studio-ideas">
            {visibleIdeas.length ? (
              visibleIdeas.map((item) => {
                const state = item.ideaState ?? "resting";
                const body = cleanIdeaText(item.text);
                return (
                  <article
                    className={classNames(
                      "studio-idea",
                      `studio-idea--${state}`,
                      focusCaptureId === item.id && "is-focused"
                    )}
                    data-idea-id={item.id}
                    key={item.id}
                  >
                    <header>
                      <span>
                        {state === "resting"
                          ? "Resting"
                          : state === "pursuing"
                            ? "Pursuing"
                            : "Let go"}
                      </span>
                      <small>{formatDate(item.updatedAt)}</small>
                    </header>
                    <h3>{conciseIdeaTitle(item)}</h3>
                    {item.title && body !== item.title ? <p>{body}</p> : null}
                    {item.description ? <p className="studio-idea-note">{item.description}</p> : null}
                    <div className="studio-idea-context">
                      <span>
                        {item.promotedAt
                          ? `Project · ${item.projectName ?? "Connected"}`
                          : item.projectName
                            ? `Captured with ${item.projectName}`
                            : "Unsorted"}
                      </span>
                      {item.tags.slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}
                    </div>
                    <footer>
                      {state === "resting" ? (
                        <>
                          <button
                            type="button"
                            disabled={ideaBusy === item.id}
                            onClick={() => void moveIdea(item, "pursuing")}
                          >
                            Pursue
                          </button>
                          <button
                            type="button"
                            disabled={ideaBusy === item.id}
                            onClick={() => void moveIdea(item, "let-go")}
                          >
                            Let go
                          </button>
                        </>
                      ) : state === "pursuing" ? (
                        <>
                          <button
                            type="button"
                            disabled={ideaBusy === item.id}
                            onClick={() => void openIdea(item, "discuss")}
                          >
                            Talk with Maker
                          </button>
                          <button
                            type="button"
                            disabled={ideaBusy === item.id}
                            onClick={() => void openIdea(item, "promote")}
                          >
                            {item.promotedAt ? "Project details" : "Make it a project"}
                          </button>
                          <button
                            type="button"
                            disabled={ideaBusy === item.id}
                            onClick={() => void moveIdea(item, "resting")}
                          >
                            Let it rest
                          </button>
                          <button
                            type="button"
                            disabled={ideaBusy === item.id}
                            onClick={() => void moveIdea(item, "let-go")}
                          >
                            Let go
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={ideaBusy === item.id}
                          onClick={() => void moveIdea(item, "resting")}
                        >
                          Bring back
                        </button>
                      )}
                    </footer>
                  </article>
                );
              })
            ) : (
              <div className="studio-empty">
                <span aria-hidden="true">✦</span>
                <strong>{emptyCopy.title}</strong>
                <p>{emptyCopy.body}</p>
              </div>
            )}
          </div>
        </section>

        <aside className="studio-notes">
          <section>
            <p className="eyebrow">How this room works</p>
            <h2>No score. No pressure.</h2>
            <p>
              Resting means the idea is safe but asks nothing of you. Pursuing means
              you have consciously chosen to spend attention on it.
            </p>
          </section>
          <section>
            <strong>Let go is a decision, not deletion.</strong>
            <p>
              Use it for ideas you have repeated too often, already explored, or simply
              no longer believe in. You can still bring one back.
            </p>
          </section>
          <section className="studio-next">
            <small>When one earns it</small>
            <p>
              Talk it through with Maker, then connect it to real work. Nothing is
              created until you choose the project yourself.
            </p>
          </section>
        </aside>
      </div>

      {activeIdea ? (
        <div
          className="studio-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeIdea();
          }}
        >
          <section
            className="studio-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-dialog-title"
          >
            <header>
              <div className="studio-dialog-resident">
                <ResidentAvatar
                  resident="maker"
                  mood={ideaSending ? "thinking" : "present"}
                />
                <div>
                  <p className="eyebrow">Studio table · Maker</p>
                  <h2 id="studio-dialog-title">{conciseIdeaTitle(activeIdea)}</h2>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close idea"
                disabled={ideaSending || promotionBusy}
                onClick={closeIdea}
              >
                ×
              </button>
            </header>

            <div className="studio-dialog-tabs" role="tablist" aria-label="Develop idea">
              <button
                type="button"
                role="tab"
                aria-selected={dialogView === "discuss"}
                className={dialogView === "discuss" ? "is-active" : ""}
                onClick={() => setDialogView("discuss")}
              >
                Talk it through
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dialogView === "promote"}
                className={dialogView === "promote" ? "is-active" : ""}
                onClick={() => setDialogView("promote")}
              >
                Make it a project
              </button>
            </div>

            {dialogView === "discuss" ? (
              <div className="studio-conversation">
                <div
                  className="studio-conversation-messages"
                  ref={messageListRef}
                  aria-live="polite"
                >
                  {conversationLoading ? (
                    <div className="studio-conversation-welcome">
                      <strong>Pulling up the idea…</strong>
                    </div>
                  ) : ideaMessages.length ? (
                    ideaMessages.map((message) => (
                      <article
                        className={classNames(
                          message.role === "user" && "is-user",
                          message.id.startsWith("pending-") && "is-pending"
                        )}
                        key={message.id}
                      >
                        <strong>{message.role === "user" ? "You" : "Maker"}</strong>
                        <p>{message.text}</p>
                      </article>
                    ))
                  ) : (
                    <div className="studio-conversation-welcome">
                      <strong>There might be something here.</strong>
                      <p>
                        Tell Maker what you’re seeing—or ask him to poke holes in it
                        before it becomes work.
                      </p>
                    </div>
                  )}
                  {ideaSending && makerStream?.text ? (
                    <article>
                      <strong>Maker</strong>
                      <p>{makerStream.text}</p>
                    </article>
                  ) : null}
                </div>
                <form onSubmit={(event) => void discussIdea(event)}>
                  <label htmlFor="studio-maker-message">Talk with Maker</label>
                  <textarea
                    id="studio-maker-message"
                    value={ideaMessage}
                    onChange={(event) => setIdeaMessage(event.target.value)}
                    onKeyDown={submitChatOnEnter}
                    placeholder="What do you think—does this have legs?"
                    maxLength={8_000}
                  />
                  <div>
                    <span>Enter to send · Shift + Enter for a new line</span>
                    <button
                      type={ideaSending ? "button" : "submit"}
                      disabled={!ideaSending && !ideaMessage.trim()}
                      onClick={ideaSending ? () => void onCancelMaker() : undefined}
                    >
                      {ideaSending ? "Stop" : "Send"}
                    </button>
                  </div>
                </form>
              </div>
            ) : activeIdea.promotedAt || promotionResult ? (
              <div className="studio-promotion-complete">
                <span aria-hidden="true">✓</span>
                <p className="eyebrow">Project connected</p>
                <h3>
                  {(promotionResult?.project.name ?? activeIdea.projectName) ||
                    "Project"}
                </h3>
                <p>
                  {promotionResult?.created
                    ? "Hearth made a clean project folder and kept the original idea in IDEA.md."
                    : "The original Studio idea now travels with this project as its starting point."}
                </p>
                <div>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={
                      !promotionResult &&
                      !catalog?.projects.some(
                        (candidate) =>
                          candidate.id === activeIdea.workspaceProjectId
                      )
                    }
                    onClick={() => {
                      const project =
                        promotionResult?.project ??
                        catalog?.projects.find(
                          (candidate) =>
                            candidate.id === activeIdea.workspaceProjectId
                        );
                      if (project) void onOpenProject(project);
                    }}
                  >
                    Open in Study
                  </button>
                  <button type="button" onClick={closeIdea}>Stay in Studio</button>
                </div>
              </div>
            ) : (
              <form className="studio-promotion" onSubmit={(event) => void promoteIdea(event)}>
                <div className="studio-promotion-intro">
                  <p className="eyebrow">A deliberate threshold</p>
                  <h3>Give the idea somewhere real to live.</h3>
                  <p>
                    This keeps the original Studio capture attached. It does not open
                    a terminal, start an agent, or initialize Git.
                  </p>
                </div>
                <div className="studio-promotion-mode" role="group" aria-label="Project type">
                  <button
                    type="button"
                    className={promotionMode === "existing" ? "is-active" : ""}
                    onClick={() => setPromotionMode("existing")}
                  >
                    Existing project
                  </button>
                  <button
                    type="button"
                    className={promotionMode === "new" ? "is-active" : ""}
                    onClick={() => setPromotionMode("new")}
                  >
                    New project
                  </button>
                </div>
                {promotionMode === "existing" ? (
                  <div className="studio-promotion-field">
                    <label htmlFor="studio-project">Connect to</label>
                    <select
                      id="studio-project"
                      value={promotionProjectId}
                      onChange={(event) => setPromotionProjectId(event.target.value)}
                    >
                      {catalog?.projects.map((project) => (
                        <option value={project.id} key={project.id}>
                          {project.name} · {project.rootPath}
                        </option>
                      ))}
                    </select>
                    <small>No project files will be changed.</small>
                  </div>
                ) : (
                  <div className="studio-promotion-field">
                    <label htmlFor="studio-project-name">Project name</label>
                    <input
                      id="studio-project-name"
                      value={newProjectName}
                      maxLength={80}
                      onChange={(event) => setNewProjectName(event.target.value)}
                    />
                    <div className="studio-destination">
                      <span>Exact destination</span>
                      <strong>
                        {catalog?.homeRoot ?? "Your home"}\Hearth Projects\
                        {newProjectName.trim() || "Project name"}
                      </strong>
                    </div>
                    <small className={!newProjectNameValid ? "is-error" : undefined}>
                      {newProjectNameValid
                        ? "Creates this folder, a small Hearth marker, and IDEA.md. Nothing else."
                        : "Use a valid Windows folder name without reserved characters or a trailing period."}
                    </small>
                  </div>
                )}
                <footer>
                  <button type="button" onClick={closeIdea}>Not yet</button>
                  <button
                    className="primary-button"
                    disabled={
                      promotionBusy ||
                      (promotionMode === "existing"
                        ? !promotionProjectId
                        : !newProjectNameValid)
                    }
                  >
                    {promotionBusy
                      ? "Connecting…"
                      : promotionMode === "existing"
                        ? "Connect idea"
                        : "Create project"}
                  </button>
                </footer>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function MessageList({
  messages,
  agentName,
  busy,
  streamText,
  onStage,
  stageBusy,
  onCancelStage
}: {
  messages: ConversationMessage[];
  agentName: string;
  busy: boolean;
  streamText?: string;
  onStage?: (messageId: string) => void;
  stageBusy?: boolean;
  onCancelStage?: () => void;
}): ReactNode {
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
    messageList.scrollLeft = 0;
  }, [messages, busy, streamText]);

  return (
    <div className="message-list" ref={messageListRef} aria-live="polite">
      {messages.map((message) => (
        <article
          className={classNames(
            "message",
            message.role === "user" && "message--user",
            message.id.startsWith("pending-") && "message--pending"
          )}
          key={message.id}
        >
          <div className="message-meta">
            <strong>{message.role === "assistant" ? agentName : "You"}</strong>
            <span>
              {message.id.startsWith("pending-")
                ? "sending"
                : formatTime(message.createdAt)}
            </span>
          </div>
          <p>{message.text}</p>
          {onStage && message.id === lastAssistantId ? (
            <button
              className="stage-workshop-button"
              type="button"
              onClick={() => (stageBusy ? onCancelStage?.() : onStage(message.id))}
              title={
                stageBusy
                  ? "Stop preparing this handoff"
                  : "Ask Maker to prepare a scoped, editable Workshop handoff"
              }
            >
              {stageBusy ? "Stop preparing" : "Prepare Workshop handoff"}{" "}
              {!stageBusy ? <span aria-hidden="true">→</span> : null}
            </button>
          ) : null}
        </article>
      ))}
      {streamText ? (
        <article className="message message--streaming">
          <div className="message-meta">
            <strong>{agentName}</strong>
            <span>writing</span>
          </div>
          <p>{streamText}<span className="stream-caret" aria-hidden="true" /></p>
        </article>
      ) : busy ? (
        <div className="typing-indicator" aria-label={`${agentName} is thinking`}>
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <div />
    </div>
  );
}

function AgentContextCard({
  context,
  empty
}: {
  context: AgentContext | null;
  empty: string;
}): ReactNode {
  if (!context) {
    return (
      <div className="agent-context-card agent-context-card--empty">
        <span>◎</span>
        <p>{empty}</p>
      </div>
    );
  }
  return (
    <div className="agent-context-card">
      <div>
        <span>{context.kind}</span>
        <strong>{context.projectName}</strong>
        <small>
          {context.kind === "evidence"
            ? context.paths.join(" · ")
            : context.path ?? context.rootPath}
        </small>
      </div>
      <p>{context.summary}</p>
      {context.concerns[0] ? <em>{context.concerns[0]}</em> : null}
    </div>
  );
}

function CriticStudy({
  data,
  onSend,
  stream,
  onCancel
}: {
  data: BootstrapData;
  onSend: (agent: AgentKey, text: string) => Promise<boolean>;
  stream: AgentStreamView | null;
  onCancel: (agent: ContextAgent) => Promise<void>;
}): ReactNode {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const context = data.agentContexts.critic;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = message.trim();
    if (!value || busy) return;
    setMessage("");
    setBusy(true);
    try {
      const completed = await onSend("critic", value);
      if (!completed) setMessage(value);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="critic-study-layout">
      <aside className="critic-profile">
        <div className="critic-portrait">
          <ResidentAvatar resident="critic" />
          <i />
        </div>
        <p className="eyebrow">Independent review</p>
        <h2>The Critic</h2>
        <p>
          Direct, skeptical, and entirely outside the terminal. He gets the evidence
          you deliberately hand over—not your whole machine and not Maker’s keyboard.
        </p>
        <ul>
          <li>Challenges claims and assumptions</li>
          <li>Looks for missing proof and broad diffs</li>
          <li>Can disagree without blocking your work</li>
        </ul>
      </aside>

      <section className="conversation-panel critic-conversation" aria-labelledby="critic-title">
        <div className="conversation-heading">
          <div>
            <p className="eyebrow">Critic conversation</p>
            <h2 id="critic-title">Make the work defend itself</h2>
          </div>
          <span className="conversation-memory">Separate handoff</span>
        </div>
        <AgentContextCard
          context={context}
          empty="Choose a project, file, diff, or evidence shelf in the Project room and send it here."
        />
        <MessageList
          messages={data.conversations.critic}
          agentName="Critic"
          busy={busy}
          streamText={stream?.text}
        />
        <form className="message-composer" onSubmit={(event) => void submit(event)}>
          <label className="sr-only" htmlFor="critic-message">Message Critic</label>
          <textarea
            id="critic-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={submitChatOnEnter}
            placeholder="Ask what’s weak, risky, or unproven…"
            maxLength={8_000}
          />
          <div className="composer-footer">
            <span>He may disagree. That’s the point.</span>
            {busy && stream ? (
              <button
                className="stop-agent-button"
                type="button"
                onClick={() => void onCancel("critic")}
              >
                Stop
              </button>
            ) : (
              <button className="send-button" disabled={!message.trim() || busy}>
                Ask <span aria-hidden="true">↑</span>
              </button>
            )}
          </div>
        </form>
      </section>

      <aside className="critic-evidence">
        <p className="eyebrow">Handoff evidence</p>
        {context ? (
          <>
            {context.evidence.map((item) => (
              <div key={item}><span>·</span><p>{item}</p></div>
            ))}
            {context.concerns.map((item) => (
              <div className="is-concern" key={item}><span>!</span><p>{item}</p></div>
            ))}
          </>
        ) : (
          <p className="evidence-copy">
            Critic is quiet until you choose what he should review.
          </p>
        )}
      </aside>
    </div>
  );
}

function StudyRoom({
  data,
  onSend,
  onUpdateObjective,
  onNavigate,
  onWorkHere,
  projectActivationBusy,
  onCapture,
  onUpdateCapture,
  onOpenNote,
  onSetAgentContext,
  onNotify,
  onSetProvider,
  streams,
  onCancelAgent,
  onStageMaker,
  proposalBusy,
  view,
  onView,
  projectOrientation,
  onGather,
  makerDraft
}: {
  data: BootstrapData;
  onSend: (agent: AgentKey, text: string) => Promise<boolean>;
  onUpdateObjective: (objective: string) => Promise<void>;
  onNavigate: (route: Room) => void;
  onWorkHere: (project: WorkspaceProjectSummary) => Promise<void>;
  projectActivationBusy: boolean;
  onCapture: (
    text: string,
    kind?: CaptureRecord["kind"]
  ) => Promise<CaptureSaveResult>;
  onUpdateCapture: (captureId: string, patch: CapturePatch) => Promise<void>;
  onOpenNote: (captureId: string) => void;
  onSetAgentContext: (
    agent: ContextAgent,
    project: WorkspaceProjectSummary,
    kind: AgentContextKind,
    path?: string,
    paths?: string[]
  ) => Promise<void>;
  onNotify: (message: string) => void;
  onSetProvider: (selection: AgentProviderSelection) => Promise<void>;
  streams: Record<ContextAgent, AgentStreamView | null>;
  onCancelAgent: (agent: ContextAgent) => Promise<void>;
  onStageMaker: (messageId: string) => void;
  proposalBusy: boolean;
  view: "projects" | "brief" | "critic";
  onView: (view: "projects" | "brief" | "critic") => void;
  projectOrientation: {
    requestId: string;
    projectId: string;
    path: string | null;
  } | null;
  onGather: () => void;
  makerDraft: { id: string; text: string } | null;
}): ReactNode {
  const [message, setMessage] = useState("");
  const [objective, setObjective] = useState(data.state.objective);
  const [busy, setBusy] = useState(false);
  const [editingObjective, setEditingObjective] = useState(false);
  const terminalSession = data.terminal.session;
  const terminalLive = Boolean(
    terminalSession &&
    ["starting", "running", "waiting"].includes(terminalSession.lifecycle)
  );

  useEffect(() => {
    setObjective(data.state.objective);
  }, [data.state.objective]);

  useEffect(() => {
    if (makerDraft) setMessage(makerDraft.text);
  }, [makerDraft]);

  async function submitMessage(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = message.trim();
    if (!value || busy) {
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      const completed = await onSend("maker", value);
      if (!completed) setMessage(value);
    } finally {
      setBusy(false);
    }
  }

  async function saveObjective(): Promise<void> {
    const value = objective.trim();
    if (!value) {
      setObjective(data.state.objective);
      setEditingObjective(false);
      return;
    }
    await onUpdateObjective(value);
    setEditingObjective(false);
  }

  return (
    <main
      className={classNames(
        "room-content",
        "study-room",
        view === "projects" && "study-room--projects",
        view === "critic" && "study-room--critic"
      )}
    >
      <div className="study-heading">
        <div>
          <p className="eyebrow">Study · direction & review</p>
          <h1>
            {view === "projects" ? "Projects" : view === "critic" ? "Critic" : "Hearth"}
          </h1>
        </div>
        <div className="study-heading-tools">
          <button className="household-gather" type="button" onClick={onGather}>
            Gather in Living Room
          </button>
          <div className="provider-choice">
            <div role="group" aria-label="Agent reasoning provider">
              <button
                type="button"
                className={data.runtime.provider.selection === "claude-code" ? "is-active" : ""}
                onClick={() => void onSetProvider("claude-code")}
              >
                Live
              </button>
              <button
                type="button"
                className={data.runtime.provider.selection === "local" ? "is-active" : ""}
                onClick={() => void onSetProvider("local")}
              >
                Local
              </button>
            </div>
            <small title={data.runtime.provider.detail}>
              {agentProviderLabel(data, view === "critic" ? "critic" : "maker")}
            </small>
          </div>
          <div className="study-presence">
            <ResidentAvatar
              resident={view === "critic" ? "critic" : "maker"}
              mood={view === "critic" || !busy ? "present" : "thinking"}
            />
            <div>
              <strong>{view === "critic" ? "Critic is here" : "Maker is here"}</strong>
              <small>
                {view === "critic"
                  ? data.runtime.provider.residents?.critic.fallbackFrom
                    ? "Independent review · Fable fallback · read-only"
                    : "Independent Codex review · read-only"
                  : data.runtime.provider.residents?.maker.state === "ready" ||
                      (!data.runtime.provider.residents &&
                        data.runtime.provider.active === "claude-code")
                    ? "Read-only side conversation · memory saved"
                    : "Local personality · conversation saved"}
              </small>
            </div>
            <span className="presence-dot" />
          </div>
        </div>
      </div>

      <div className="study-view-tabs" role="tablist" aria-label="Study view">
        <button
          className={view === "projects" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={view === "projects"}
          onClick={() => onView("projects")}
        >
          Project room
        </button>
        <button
          className={view === "brief" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={view === "brief"}
          onClick={() => onView("brief")}
        >
          Brief & Maker
        </button>
        <button
          className={view === "critic" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={view === "critic"}
          onClick={() => onView("critic")}
        >
          Critic
        </button>
      </div>

      {view === "projects" ? (
        <Suspense fallback={<div className="project-surface-loading">Opening the project shelf…</div>}>
          <ProjectSurface
            currentProject={data.workspace.selectedProject}
            terminalLive={terminalLive}
            terminalRoot={terminalSession?.cwd ?? null}
            onWorkHere={onWorkHere}
            activationBusy={projectActivationBusy}
            onShareContext={onSetAgentContext}
            onOpenMaker={() => onView("brief")}
            notes={data.captures}
            onCaptureNote={onCapture}
            onUpdateNote={onUpdateCapture}
            onOpenNote={onOpenNote}
            onNotify={onNotify}
            orientation={projectOrientation}
          />
        </Suspense>
      ) : view === "critic" ? (
        <CriticStudy
          data={data}
          onSend={onSend}
          stream={streams.critic}
          onCancel={onCancelAgent}
        />
      ) : (
        <div className="study-layout">
        <aside className="study-brief">
          <div className="brief-section">
            <p className="eyebrow">Active objective</p>
            {editingObjective ? (
              <div className="objective-editor">
                <textarea
                  value={objective}
                  onChange={(event) => setObjective(event.target.value)}
                  autoFocus
                  maxLength={2_000}
                />
                <div>
                  <button className="small-button" onClick={() => void saveObjective()}>
                    Save objective
                  </button>
                  <button
                    className="small-button small-button--quiet"
                    onClick={() => {
                      setObjective(data.state.objective);
                      setEditingObjective(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2>{data.state.objective}</h2>
                <button className="text-button" onClick={() => setEditingObjective(true)}>
                  Clarify objective
                </button>
              </>
            )}
          </div>

          <div className="brief-section">
            <p className="eyebrow">Working agreement</p>
            <ul className="plain-list">
              <li><span>1</span> Process truth before convenience</li>
              <li><span>2</span> One terminal owner at a time</li>
              <li><span>3</span> Raw output stays out of memory</li>
            </ul>
          </div>

          <div className="brief-section brief-section--truth">
            <p className="eyebrow">Process truth</p>
            <div className="process-truth">
              <span className="status-dot" />
              <div>
                <strong>
                  {terminalLive
                    ? `${terminalSession?.kind === "claude" ? "Claude Code" : "PowerShell"} is running`
                    : terminalSession?.kind === "claude" &&
                        terminalSession.claudeSessionId &&
                        terminalSession.claudeResumable
                      ? "Claude Code can be resumed"
                      : "No session running"}
                </strong>
                <small>
                  {terminalLive
                    ? `PID ${terminalSession?.pid} · ${terminalSession?.owner === "maker" ? "Maker" : "you"} in control`
                    : "Workshop is quiet"}
                </small>
              </div>
            </div>
            <button className="text-button" onClick={() => onNavigate("workshop")}>
              Open Workshop <span aria-hidden="true">→</span>
            </button>
          </div>
        </aside>

        <section className="conversation-panel" aria-labelledby="maker-conversation-title">
          <div className="conversation-heading">
            <div className="resident-conversation-heading">
              <ResidentAvatar
                resident="maker"
                mood={busy ? "thinking" : "present"}
              />
              <div>
                <p className="eyebrow">Maker conversation</p>
                <h2 id="maker-conversation-title">Talk through the work</h2>
              </div>
            </div>
            <span className="conversation-memory">Local memory on</span>
          </div>

          <AgentContextCard
            context={data.agentContexts.maker}
            empty="Choose a project, file, diff, or evidence shelf in the Project room when you want Maker grounded in specific evidence."
          />

          <MessageList
            messages={data.conversations.maker}
            agentName="Maker"
            busy={busy}
            streamText={streams.maker?.text}
            onStage={onStageMaker}
            stageBusy={proposalBusy}
            onCancelStage={() => void onCancelAgent("maker")}
          />

          <form className="message-composer" onSubmit={(event) => void submitMessage(event)}>
            <label className="sr-only" htmlFor="maker-message">
              Message Maker
            </label>
            <textarea
              id="maker-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={submitChatOnEnter}
              placeholder="Talk to Maker naturally…"
              maxLength={8_000}
            />
            <div className="composer-footer">
              <span>Shift + Enter for a new line</span>
              {busy && streams.maker ? (
                <button
                  className="stop-agent-button"
                  type="button"
                  onClick={() => void onCancelAgent("maker")}
                >
                  Stop
                </button>
              ) : (
                <button className="send-button" disabled={!message.trim() || busy}>
                  Send <span aria-hidden="true">↑</span>
                </button>
              )}
            </div>
          </form>
        </section>

        <aside className="study-evidence">
          <section>
            <p className="eyebrow">Current truth</p>
            <div className="evidence-item">
              <span className="evidence-mark evidence-mark--green">✓</span>
              <div>
                <strong>Core owns state</strong>
                <small>Renderer reload is safe</small>
              </div>
            </div>
            <div className="evidence-item">
              <span className="evidence-mark evidence-mark--green">✓</span>
              <div>
                <strong>Database is live</strong>
                <small>{data.runtime.databaseJournalMode.toUpperCase()} journal mode</small>
              </div>
            </div>
            <div className="evidence-item">
              <span className={`evidence-mark ${terminalSession ? "evidence-mark--green" : ""}`}>
                {terminalSession ? "✓" : "—"}
              </span>
              <div>
                <strong>{terminalSession ? "Terminal truth attached" : "Terminal ready"}</strong>
                <small>
                  {terminalSession
                    ? `${terminalSession.lifecycle} · ${terminalSession.kind}`
                    : "No process is being implied"}
                </small>
              </div>
            </div>
          </section>

          <section>
            <p className="eyebrow">Next proof</p>
            <p className="evidence-copy">
              Start a Workshop session, return here while it keeps running, then reload
              Hearth and reattach without creating a duplicate process.
            </p>
          </section>

          <section className="return-preview">
            <p className="eyebrow">Return Pack will keep</p>
            <ul>
              <li>Where the conversation stopped</li>
              <li>Actual process state</li>
              <li>Your objective and next action</li>
              <li>Captures attached to Hearth</li>
            </ul>
          </section>
        </aside>
        </div>
      )}
    </main>
  );
}

function Companion({
  messages,
  providerLabel,
  onSend
}: {
  messages: ConversationMessage[];
  providerLabel: string;
  onSend: (agent: AgentKey, text: string) => Promise<boolean>;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [noticedReply, setNoticedReply] = useState(false);
  const [pointerPose, setPointerPose] = useState<CompanionMood>("idle");
  const [proximity, setProximity] = useState<"far" | "near" | "direct">("far");
  const [pointerTracking, setPointerTracking] = useState(false);
  const [gesture, setGesture] = useState<"wave" | "jump" | null>(null);
  const [failed, setFailed] = useState(false);
  const [gazeIndex, setGazeIndex] = useState<number | null>(null);
  const [ambientGazeIndex, setAmbientGazeIndex] = useState<number | null>(null);
  const [framesReady, setFramesReady] = useState(false);
  const gestureCompletion = useRef<(() => void) | null>(null);
  const pointerIdleTimer = useRef<number | null>(null);
  const ambientTimer = useRef<number | null>(null);
  const failureTimer = useRef<number | null>(null);
  const [documentVisible, setDocumentVisible] = useState(
    () => document.visibilityState !== "hidden"
  );
  const assistantMessageCount = messages.filter(
    (entry) => entry.role === "assistant"
  ).length;
  const previousAssistantMessageCount = useRef(assistantMessageCount);

  useEffect(() => {
    const updateVisibility = (): void => {
      setDocumentVisible(document.visibilityState !== "hidden");
    };
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => () => {
    if (pointerIdleTimer.current !== null) window.clearTimeout(pointerIdleTimer.current);
    if (ambientTimer.current !== null) window.clearTimeout(ambientTimer.current);
    if (failureTimer.current !== null) window.clearTimeout(failureTimer.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const frames = companionFrameSources.map((source) => {
      const image = new Image();
      image.src = source;
      return image.decode().catch(() => undefined);
    });
    void Promise.all(frames).then(() => {
      if (!cancelled) setFramesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !documentVisible || !framesReady || open || busy || noticedReply || pointerTracking) {
      setAmbientGazeIndex(null);
      return;
    }

    const glances = [14, 15, 0, 1, 2] as const;
    const scheduleGlance = (): void => {
      const delay = 12_000 + Math.round(Math.random() * 9_000);
      ambientTimer.current = window.setTimeout(() => {
        const glance = glances[Math.floor(Math.random() * glances.length)] ?? 0;
        setAmbientGazeIndex(glance);
        ambientTimer.current = window.setTimeout(() => {
          setAmbientGazeIndex(null);
          scheduleGlance();
        }, 1_450 + Math.round(Math.random() * 650));
      }, delay);
    };

    scheduleGlance();
    return () => {
      if (ambientTimer.current !== null) {
        window.clearTimeout(ambientTimer.current);
        ambientTimer.current = null;
      }
    };
  }, [busy, documentVisible, framesReady, noticedReply, open, pointerTracking]);

  useEffect(() => {
    if (!documentVisible || !framesReady || open || busy || noticedReply || gesture) return;
    const followPointer = (event: PointerEvent | MouseEvent): void => {
      const anchor = document.querySelector<HTMLElement>(".companion-button");
      if (!anchor) return;
      const bounds = anchor.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const deltaX = event.clientX - centerX;
      const deltaY = event.clientY - centerY;
      const distance = Math.hypot(deltaX, deltaY);
      setPointerTracking(true);
      setAmbientGazeIndex(null);
      if (pointerIdleTimer.current !== null) window.clearTimeout(pointerIdleTimer.current);
      pointerIdleTimer.current = window.setTimeout(() => {
        setPointerTracking(false);
        setProximity("far");
        setGazeIndex(null);
        setPointerPose("idle");
        pointerIdleTimer.current = null;
      }, 3_200);
      if (distance < 42) {
        // Keep the last direction when the pointer reaches him. Resetting to
        // centre at this point made him appear to stop responding precisely
        // when the user was engaging with him.
        setGazeIndex((current) => current ?? 0);
      } else {
        const angle = Math.atan2(deltaX, -deltaY);
        const nextGaze = Math.round(angle / (Math.PI / 8) + 16) % 16;
        setGazeIndex((current) => current === nextGaze ? current : nextGaze);
      }
      const nextProximity = distance < 105 ? "direct" : distance < 310 ? "near" : "far";
      setProximity((current) => current === nextProximity ? current : nextProximity);
      const nextPose: CompanionMood = distance < 175
        ? "idle"
        : event.clientY < centerY - 105
          ? "track-high"
          : event.clientY > centerY + 70
            ? "resting"
            : "track-level";
      setPointerPose((current) => current === nextPose ? current : nextPose);
    };

    window.addEventListener("pointermove", followPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", followPointer);
      if (pointerIdleTimer.current !== null) {
        window.clearTimeout(pointerIdleTimer.current);
        pointerIdleTimer.current = null;
      }
      setProximity("far");
      setPointerTracking(false);
      setGazeIndex(null);
    };
  }, [busy, documentVisible, framesReady, gesture, noticedReply, open]);

  useEffect(() => {
    const previous = previousAssistantMessageCount.current;
    previousAssistantMessageCount.current = assistantMessageCount;
    if (assistantMessageCount <= previous || open) {
      return;
    }
    setNoticedReply(true);
    const timeout = window.setTimeout(() => setNoticedReply(false), 4_500);
    return () => window.clearTimeout(timeout);
  }, [assistantMessageCount, open]);

  const mood: CompanionMood = busy
    ? "thinking"
    : failed
      ? "failed"
      : noticedReply
        ? "reply"
        : pointerPose;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = message.trim();
    if (!value || busy) {
      return;
    }
    setMessage("");
    setBusy(true);
    try {
      const completed = await onSend("companion", value);
      if (!completed) {
        setMessage(value);
        setFailed(true);
        if (failureTimer.current !== null) window.clearTimeout(failureTimer.current);
        failureTimer.current = window.setTimeout(() => {
          setFailed(false);
          failureTimer.current = null;
        }, 2_300);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="companion"
      data-document-visible={documentVisible ? "true" : "false"}
      data-proximity={proximity}
      data-pointer-tracking={pointerTracking ? "true" : "false"}
      data-acknowledging="false"
      data-ambient-gesture="none"
    >
      {open ? (
        <section className="companion-popover" aria-labelledby="companion-title">
          <div className="companion-heading">
            <CompanionCharacter mood={busy ? "thinking" : "idle"} compact />
            <div>
              <p className="eyebrow">{busy ? "Thinking nearby" : "Around the house"}</p>
              <h2 id="companion-title">Companion</h2>
              <small className="companion-provider">{providerLabel}</small>
            </div>
            <button
              className="close-button"
              onClick={() => setOpen(false)}
              aria-label="Close companion"
            >
              ×
            </button>
          </div>
          <MessageList messages={messages.slice(-8)} agentName="Companion" busy={busy} />
          <form className="companion-composer" onSubmit={(event) => void submit(event)}>
            <label className="sr-only" htmlFor="companion-message">
              Message Companion
            </label>
            <textarea
              id="companion-message"
              rows={1}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={submitChatOnEnter}
              placeholder="Ask or talk about anything here…"
              maxLength={8_000}
            />
            <button disabled={!message.trim() || busy} aria-label="Send message">
              ↑
            </button>
          </form>
        </section>
      ) : null}

      <button
        className={classNames("companion-button", open && "is-open")}
        onClick={() => {
          setNoticedReply(false);
          if (!open) setGesture("wave");
          setOpen((current) => !current);
        }}
        aria-label={open ? "Close Companion" : "Talk to Companion"}
        aria-expanded={open}
      >
        <CompanionCharacter
          mood={mood}
          framesReady={framesReady}
          gesture={gesture}
          gazeIndex={pointerTracking ? gazeIndex : ambientGazeIndex}
          onGestureComplete={() => setGesture(null)}
        />
      </button>
      {!open ? (
        <span className="companion-label">
          {noticedReply ? "I’m here" : "Talk to me"}
        </span>
      ) : null}
    </div>
  );
}

function LeaveDialog({
  onClose,
  onLeave
}: {
  onClose: () => void;
  onLeave: (note?: string) => Promise<void>;
}): ReactNode {
  const [note, setNote] = useState("");
  const [leaving, setLeaving] = useState(false);

  async function confirm(): Promise<void> {
    setLeaving(true);
    try {
      await onLeave(note.trim() || undefined);
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="leave-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="leave-dialog__icon" aria-hidden="true">☾</div>
        <p className="eyebrow">Leave well</p>
        <h2 id="leave-dialog-title">Anything you want waiting for you?</h2>
        <p>
          Hearth will save the objective, conversation, captures, and actual process
          state automatically. Add a human note only if it helps.
        </p>
        <label htmlFor="leave-note">Optional note</label>
        <textarea
          id="leave-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="I was thinking about…"
          maxLength={4_000}
          autoFocus
        />
        <div className="dialog-actions">
          <button className="small-button small-button--quiet" onClick={onClose}>
            Stay here
          </button>
          <button className="primary-button" onClick={() => void confirm()} disabled={leaving}>
            {leaving ? "Saving…" : "Create Return Pack"}
          </button>
        </div>
      </section>
    </div>
  );
}

function LoadingScreen(): ReactNode {
  return (
    <div className="loading-screen">
      <div className="loading-mark">
        <span>H</span>
        <i />
      </div>
      <p>Opening the house…</p>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }): ReactNode {
  return (
    <div className="error-screen">
      <span>!</span>
      <h1>Hearth couldn’t open cleanly.</h1>
      <p>{message}</p>
      <button className="primary-button" onClick={onRetry}>Try again</button>
    </div>
  );
}

export function App(): ReactNode {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [workshopFocus, setWorkshopFocus] = useState(false);
  const [workshopShelfCollapsed, setWorkshopShelfCollapsed] = useState(false);
  const [studyView, setStudyView] = useState<"projects" | "brief" | "critic">("projects");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchCatalog, setSearchCatalog] = useState<WorkspaceCatalog | null>(null);
  const [houseMemoryOpenRequest, setHouseMemoryOpenRequest] = useState(0);
  const [focusedCaptureId, setFocusedCaptureId] = useState<string | null>(null);
  const [historicalReturnPack, setHistoricalReturnPack] =
    useState<ReturnPack | null>(null);
  const [projectOrientation, setProjectOrientation] = useState<{
    requestId: string;
    projectId: string;
    path: string | null;
  } | null>(null);
  const [agentStreams, setAgentStreams] = useState<
    Record<ContextAgent, AgentStreamView | null>
  >({
    maker: null,
    critic: null
  });
  const [proposalBusy, setProposalBusy] = useState(false);
  const [projectActivationBusy, setProjectActivationBusy] = useState(false);
  const [makerWorkActivities, setMakerWorkActivities] = useState<MakerWorkActivity[]>([]);
  const [makerWorkPlan, setMakerWorkPlan] = useState<MakerWorkPlanEntry[]>([]);
  const [makerThoughts, setMakerThoughts] = useState("");
  const [makerSessionState, setMakerSessionState] = useState<MakerSessionState | null>(null);
  const [makerTurnHealth, setMakerTurnHealth] = useState<WorkshopTurnHealth | null>(null);
  const [makerTurnUsage, setMakerTurnUsage] = useState<WorkshopTurnUsage | null>(null);
  const [makerContextManifest, setMakerContextManifest] = useState<WorkshopContextManifest | null>(null);
  const [makerPermissions, setMakerPermissions] = useState<MakerPermissionRequest[]>([]);
  const [makerWorkRequestId, setMakerWorkRequestId] = useState<string | null>(null);
  const [makerWorking, setMakerWorking] = useState(false);
  const [makerDraft, setMakerDraft] = useState<{
    id: string;
    text: string;
    destination: "study" | "workshop";
  } | null>(null);
  const selectedProjectIdRef = useRef<string | null>(null);
  const projectActivationBusyRef = useRef(false);
  const makerRequestProjectsRef = useRef(new Map<string, string | null>());

  const route = data?.state.lastRoute ?? "home";
  const projectName = data?.workspace.selectedProject.name ?? "Hearth";

  async function load(): Promise<void> {
    try {
      setError(null);
      const next = await window.hearth.bootstrap();
      setData(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The local core did not respond.");
    }
  }

  function applyLivingRoomSnapshot(snapshot: LivingRoomSnapshot): void {
    setData((current) => current ? { ...current, livingRoom: snapshot } : current);
  }

  async function gatherInLivingRoom(
    context: LivingRoomContext,
    participants: AgentKey[] = ["maker", "critic", "companion"]
  ): Promise<void> {
    if (!data) return;
    try {
      const snapshot = await window.hearth.createLivingRoomDiscussion(
        participants.length === 1 ? "conversation" : "roundtable",
        participants,
        true,
        context
      );
      applyLivingRoomSnapshot(snapshot);
      await navigate("living");
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "The household couldn't gather around that yet.");
    }
  }

  function draftLivingRoomDecision(
    text: string,
    destination: "study" | "workshop"
  ): void {
    setMakerDraft({ id: crypto.randomUUID(), text, destination });
    if (destination === "study") setStudyView("brief");
    void navigate(destination);
    setToast(destination === "workshop" ? "The decision is waiting in Maker's Workshop composer." : "The decision is waiting in Maker's Study composer.");
  }

  async function saveLivingRoomDecision(text: string): Promise<void> {
    if (!data) return;
    const projectMention = `@"${data.workspace.selectedProject.name.replaceAll('"', "")}"`;
    await capture(`@note ${projectMention} ${text}`, "note");
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!data?.workspace.selectedProject.id) return;
    selectedProjectIdRef.current = data.workspace.selectedProject.id;
    const activeTurn = data.workshop.turns.findLast((turn) => turn.status === "running") ?? null;
    setMakerWorkActivities(activeTurn?.activities ?? []);
    setMakerWorkPlan(activeTurn?.plan ?? []);
    setMakerThoughts(activeTurn?.thoughts ?? "");
    setMakerSessionState(activeTurn?.sessionState ?? null);
    setMakerTurnHealth(activeTurn?.health ?? null);
    setMakerTurnUsage(activeTurn?.usage ?? null);
    setMakerContextManifest(activeTurn?.contextManifest ?? null);
    setMakerPermissions(activeTurn?.permissions ?? []);
    setMakerWorkRequestId(activeTurn?.id ?? null);
    setMakerWorking(Boolean(activeTurn));
    if (activeTurn) {
      makerRequestProjectsRef.current.set(activeTurn.id, data.workspace.selectedProject.id);
    }
    setAgentStreams((current) => ({ ...current, maker: null }));
  }, [data?.workspace.selectedProject.id]);

  useEffect(() => {
    function openSearchShortcut(event: globalThis.KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        void openSearch();
      }
    }
    window.addEventListener("keydown", openSearchShortcut);
    return () => window.removeEventListener("keydown", openSearchShortcut);
  }, []);

  useEffect(() => {
    return window.hearth.onCompanionSync((event) => {
      void load();
      if (event.kind === "capture") {
        setToast("A Companion capture just arrived.");
      } else if (event.kind === "decision") {
        setToast("A phone decision was saved.");
      }
    });
  }, []);

  useEffect(() => {
    return window.hearth.onNotificationNavigation((nextRoom) => {
      if (nextRoom === "study") setStudyView("projects");
      void navigate(nextRoom);
    });
  }, []);

  useEffect(() => {
    return window.hearth.onTerminalEvent((event) => {
      if (event.type === "output") {
        return;
      }
      if (event.type === "proposal" && event.criticHandoff) {
        setToast("Maker brought Critic in for a second set of eyes.");
      }
      setData((current) => {
        if (!current) {
          return current;
        }
        if (event.type === "observation") {
          return {
            ...current,
            terminal: {
              ...current.terminal,
              observation: event.observation,
              sequence: event.sequence
            }
          };
        }
        if (event.type === "proposal") {
          return {
            ...current,
            makerProposal: event.proposal,
            conversations: event.criticHandoff
              ? {
                  ...current.conversations,
                  critic: event.criticHandoff.messages
                }
              : current.conversations,
            agentContexts: event.criticHandoff
              ? {
                  ...current.agentContexts,
                  critic: event.criticHandoff.context
                }
              : current.agentContexts,
            terminal: {
              ...current.terminal,
              sequence: event.sequence
            }
          };
        }
        const live = Boolean(event.session && ["starting", "running", "waiting"].includes(event.session.lifecycle));
        return {
          ...current,
          runtime: {
            ...current.runtime,
            liveProcesses: live ? 1 : 0
          },
          terminal: {
            ...current.terminal,
            session: event.session,
            sequence: event.sequence
          }
        };
      });
    });
  }, []);

  useEffect(() => {
    return window.hearth.onAgentStreamEvent((event: AgentStreamEvent) => {
      if (event.agent === "maker" && event.type === "started") {
        makerRequestProjectsRef.current.set(
          event.requestId,
          selectedProjectIdRef.current
        );
      }
      const makerEventProject =
        event.agent === "maker"
          ? makerRequestProjectsRef.current.get(event.requestId)
          : null;
      const belongsToSelectedProject =
        event.agent !== "maker" ||
        makerEventProject === undefined ||
        makerEventProject === selectedProjectIdRef.current;
      if (!belongsToSelectedProject) {
        if (event.type === "completed" || event.type === "failed") void load();
        if (event.type === "completed" || event.type === "cancelled" || event.type === "failed") {
          makerRequestProjectsRef.current.delete(event.requestId);
        }
        return;
      }
      if (event.agent === "maker") {
        if (event.type === "started") {
          setMakerWorkRequestId(event.requestId);
          setMakerWorking(true);
          setMakerWorkActivities([]);
          setMakerWorkPlan([]);
          setMakerThoughts("");
          setMakerPermissions([]);
          setMakerTurnHealth(null);
          setMakerTurnUsage(null);
          setMakerContextManifest(event.contextManifest ?? null);
        } else if (event.type === "activity") {
          setMakerWorkActivities((current) => {
            const existing = current.findIndex((item) => item.id === event.activity.id);
            if (existing < 0) return [...current, event.activity].slice(-40);
            const next = [...current];
            next[existing] = event.activity;
            return next;
          });
        } else if (event.type === "thought") {
          setMakerThoughts((current) => (current + event.text).slice(-16_000));
        } else if (event.type === "plan") {
          setMakerWorkPlan(event.entries);
        } else if (event.type === "session_state") {
          setMakerSessionState(event.state);
        } else if (event.type === "health") {
          setMakerTurnHealth(event.health);
        } else if (event.type === "usage") {
          setMakerTurnUsage(event.usage);
        } else if (event.type === "permission") {
          setMakerPermissions((current) => [
            ...current.filter((item) => item.id !== event.permission.id),
            event.permission
          ]);
        } else if (event.type === "permission_resolved") {
          setMakerPermissions((current) =>
            current.filter((item) => item.id !== event.permissionId)
          );
        } else if (event.type === "completed" || event.type === "cancelled" || event.type === "failed") {
          setMakerWorking(false);
          setMakerPermissions([]);
          makerRequestProjectsRef.current.delete(event.requestId);
        }
      }
      if (event.type === "completed" || event.type === "failed") {
        void load();
      }
      setAgentStreams((current) => {
        if (event.type === "started") {
          return {
            ...current,
            [event.agent]: {
              requestId: event.requestId,
              text: ""
            }
          };
        }
        const active = current[event.agent];
        if (!active || active.requestId !== event.requestId) {
          return current;
        }
        if (event.type === "delta") {
          return {
            ...current,
            [event.agent]: {
              ...active,
              text: active.text + event.text
            }
          };
        }
        if (event.type === "delta_reset") {
          return {
            ...current,
            [event.agent]: {
              ...active,
              text: ""
            }
          };
        }
        if (event.type === "completed" || event.type === "cancelled" || event.type === "failed") {
          return {
            ...current,
            [event.agent]: null
          };
        }
        return current;
      });
    });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 3_000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const companionMessages = useMemo(
    () => data?.conversations.companion ?? [],
    [data?.conversations.companion]
  );

  async function navigate(nextRoute: Room): Promise<void> {
    if (!data) {
      return;
    }
    if (nextRoute !== "home") {
      setHistoricalReturnPack(null);
    }
    if (nextRoute !== "study") {
      setProjectOrientation(null);
    }
    if (nextRoute === route) {
      if (nextRoute === "home") setHistoricalReturnPack(null);
      return;
    }
    if (nextRoute !== "workshop") {
      setWorkshopFocus(false);
    }
    const state = await window.hearth.setRoute(nextRoute);
    setData((current) => (current ? { ...current, state } : current));
  }

  async function openSearch(): Promise<void> {
    setSearchOpen(true);
    try {
      setSearchCatalog(await window.hearth.listWorkspaceProjects());
    } catch {
      // Capture search remains useful even if project discovery is unavailable.
    }
  }

  async function openSearchResult(result: HearthSearchResult): Promise<void> {
    setSearchOpen(false);
    if (result.kind === "memory") {
      await navigate("home");
      setHouseMemoryOpenRequest((request) => request + 1);
      return;
    }
    if (result.kind === "project") {
      await openProjectInStudy(result.project);
      return;
    }
    setData((current) => {
      if (!current || current.captures.some((item) => item.id === result.capture.id)) {
        return current;
      }
      return {
        ...current,
        captures: [result.capture, ...current.captures].slice(0, 200)
      };
    });
    setFocusedCaptureId(result.capture.id);
    await navigate(result.kind === "library" ? "library" : "studio");
  }

  function applyTerminalSnapshot(snapshot: TerminalSnapshot): void {
    setData((current) => {
      if (!current) {
        return current;
      }
      const live = Boolean(
        snapshot.session &&
        ["starting", "running", "waiting"].includes(snapshot.session.lifecycle)
      );
      return {
        ...current,
        runtime: {
          ...current.runtime,
          liveProcesses: live ? 1 : 0
        },
        terminal: snapshot
      };
    });
  }

  async function startTerminal(
    kind: TerminalKind,
    owner: TerminalOwner
  ): Promise<void> {
    try {
      const snapshot = await window.hearth.startTerminal(kind, owner);
      applyTerminalSnapshot(snapshot);
      setToast(
        kind === "claude"
          ? "Claude Code started in a named Hearth session."
          : `${snapshot.capabilities.shellName} started in Workshop.`
      );
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "The terminal could not start.");
    }
  }

  async function resumeTerminal(owner: TerminalOwner): Promise<void> {
    try {
      const snapshot = await window.hearth.resumeTerminal(owner);
      applyTerminalSnapshot(snapshot);
      setToast("The same Claude Code session is resuming.");
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "The session could not resume.");
    }
  }

  async function stopTerminal(sessionId: string): Promise<void> {
    try {
      const session = await window.hearth.stopTerminal(sessionId);
      applyTerminalSnapshot({
        ...(data?.terminal ?? {
          capabilities: {
            shellName: "Windows PowerShell",
            shellPath: "powershell.exe",
            claudeAvailable: false,
            claudePath: null,
            claudeVersion: null,
            supportsNamedSessions: false,
            supportsSessionId: false,
            supportsResume: false
          },
          scrollback: "",
          sequence: 0,
          truncated: false,
          observation: {
            state: "quiet",
            summary: "No Workshop process is running.",
            requiresInput: false,
            updatedAt: new Date().toISOString()
          }
        }),
        session
      });
      setToast("Workshop session stopped cleanly.");
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "The session could not stop.");
    }
  }

  async function returnToTerminalProject(): Promise<void> {
    const terminalRoot = data?.terminal.session?.cwd;
    if (!data || !terminalRoot) return;
    try {
      const catalog = await window.hearth.listWorkspaceProjects();
      const project = catalog.projects.find(
        (candidate) =>
          candidate.rootPath.toLocaleLowerCase() === terminalRoot.toLocaleLowerCase()
      );
      if (!project) {
        setToast("The terminal project is no longer in Hearth’s project catalog.");
        return;
      }
      const selected = await window.hearth.selectWorkspaceProject(project.id);
      const fresh = await window.hearth.bootstrap();
      setData({ ...fresh, workspace: { selectedProject: selected } });
      setToast(`${selected.name} is current again. Its Claude Code session never moved.`);
    } catch (reason) {
      setToast(
        reason instanceof Error ? reason.message : "Hearth could not return to that project."
      );
    }
  }

  async function parkTerminalAndOpenSelectedProject(): Promise<void> {
    if (!data) return;
    await workInProject(data.workspace.selectedProject);
  }

  async function setTerminalOwner(
    sessionId: string,
    owner: TerminalOwner
  ): Promise<void> {
    try {
      const session: TerminalSession = await window.hearth.setTerminalOwner(
        sessionId,
        owner
      );
      setData((current) =>
        current
          ? {
              ...current,
              terminal: {
                ...current.terminal,
                session
              }
            }
          : current
      );
      setToast(
        owner === "maker"
          ? "Maker can see the recent terminal. Instructions still need a handoff."
          : "Terminal control returned to you."
      );
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Control could not change.");
    }
  }

  async function passTerminalInstruction(
    sessionId: string,
    proposalId: string,
    text: string
  ): Promise<void> {
    try {
      await window.hearth.terminalInstruction(sessionId, proposalId, text);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "The instruction could not be passed.";
      setToast(message);
      throw reason;
    }
  }

  async function capture(
    text: string,
    kind?: CaptureRecord["kind"]
  ): Promise<CaptureSaveResult> {
    if (!data) {
      throw new Error("Capture is not available yet.");
    }
    const result = await window.hearth.saveCapture(text, kind);
    setData((current) => {
      if (!current) return current;
      const captures = result.duplicate
        ? current.captures.map((item) =>
            item.id === result.capture.id ? result.capture : item
          )
        : [result.capture, ...current.captures].slice(0, 200);
      return { ...current, captures };
    });
    setToast(
      result.duplicate
        ? "Already saved—nothing duplicated."
        : result.capture.kind === "link"
          ? "Link kept for the Library."
          : result.capture.kind === "idea"
            ? "Idea is resting in Studio."
            : result.capture.projectName
              ? `Note connected to ${result.capture.projectName}.`
              : "Loose note is waiting in Studio."
    );
    if (!result.duplicate && result.capture.kind === "link") {
      void enrichCapture(result.capture.id, true);
    }
    return result;
  }

  async function updateCapture(
    captureId: string,
    patch: CapturePatch
  ): Promise<void> {
    try {
      const updated = await window.hearth.updateCapture(captureId, patch);
      setData((current) =>
        current
          ? {
              ...current,
              captures: current.captures.map((item) =>
                item.id === updated.id ? updated : item
              )
            }
          : current
      );
      setToast(
        patch.workspaceProjectId === null
          ? "Note moved to Loose Notes."
          : patch.ideaState === "pursuing"
          ? "That idea is being pursued."
          : patch.ideaState === "let-go"
            ? "Let go. It stays recoverable."
            : patch.ideaState === "resting"
              ? "The idea is resting again."
              : updated.archived
                ? "Put away. It can be restored anytime."
                : "Saved material updated."
      );
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "That saved item could not be updated.";
      setToast(message);
      throw reason;
    }
  }

  async function removeArchiveItem(
    archiveId: string,
    kind: ArchiveKind
  ): Promise<ArchiveRemovalResult> {
    const result = await window.hearth.removeArchiveItem(archiveId, kind);
    const fresh = await window.hearth.bootstrap();
    setData(fresh);
    return result;
  }

  async function sendIdeaMessage(
    captureId: string,
    text: string
  ): Promise<AgentMessageUpdate> {
    const update = await window.hearth.sendIdeaMessage(captureId, text);
    setData((current) =>
      current
        ? {
            ...current,
            runtime: {
              ...current.runtime,
              provider: update.provider
            }
          }
        : current
    );
    return update;
  }

  async function promoteIdea(
    captureId: string,
    target: IdeaPromotionTarget
  ): Promise<IdeaPromotionResult> {
    const result = await window.hearth.promoteIdea(captureId, target);
    setData((current) =>
      current
        ? {
            ...current,
            captures: current.captures.map((item) =>
              item.id === result.capture.id ? result.capture : item
            )
          }
        : current
    );
    setToast(
      result.created
        ? `${result.project.name} is ready. The original idea is in IDEA.md.`
        : `The idea is now connected to ${result.project.name}.`
    );
    return result;
  }

  async function openProjectInStudy(
    project: WorkspaceProjectSummary
  ): Promise<void> {
    try {
      const state = await window.hearth.setRoute("study");
      const fresh = await window.hearth.bootstrap();
      setData({ ...fresh, state });
      setStudyView("projects");
      setProjectOrientation({
        requestId: crypto.randomUUID(),
        projectId: project.id,
        path: null
      });
      setToast(`Reviewing ${project.name} in Study. Your current project did not change.`);
    } catch (reason) {
      setToast(
        reason instanceof Error
          ? reason.message
          : "That project could not be opened."
      );
    }
  }

  async function openArchivedReturnPack(pack: ReturnPack): Promise<void> {
    setHistoricalReturnPack(pack);
    await navigate("home");
    setToast("Saved Return Pack opened on Home. Current work stayed as-is.");
  }

  async function orientFromArchive(
    projectId: string,
    projectPath: string | null,
    destination: "project" | "workshop"
  ): Promise<void> {
    if (!data) return;
    try {
      const catalog = await window.hearth.listWorkspaceProjects();
      const target = catalog.projects.find((project) => project.id === projectId);
      if (!target) {
        throw new Error("That archived project is no longer in Hearth’s project catalog.");
      }
      if (destination === "project") {
        const state = await window.hearth.setRoute("study");
        const fresh = await window.hearth.bootstrap();
        setData({ ...fresh, state });
        setStudyView("projects");
        setProjectOrientation({
          requestId: crypto.randomUUID(),
          projectId: target.id,
          path: projectPath
        });
        setToast(
          projectPath
            ? `Reviewing ${target.name} · ${projectPath}. Your current project did not change.`
            : `Reviewing ${target.name} in Study. Your current project did not change.`
        );
        return;
      }
      await workInProject(target);
    } catch (reason) {
      setToast(
        reason instanceof Error
          ? reason.message
          : "That archived project could not be opened."
      );
    }
  }

  async function enrichCapture(captureId: string, quiet = false): Promise<void> {
    try {
      const updated = await window.hearth.enrichCapture(captureId);
      setData((current) =>
        current
          ? {
              ...current,
              captures: current.captures.map((item) =>
                item.id === updated.id ? updated : item
              )
            }
          : current
      );
      if (!quiet) {
        setToast(
          updated.title || updated.description
            ? "Link details added."
            : "The page did not provide useful details."
        );
      }
    } catch (reason) {
      if (!quiet) {
        setToast(
          reason instanceof Error
            ? reason.message
            : "Hearth could not read details from that link."
        );
        throw reason;
      }
    }
  }

  async function refreshLibraryDiscovery(force: boolean): Promise<void> {
    try {
      const libraryDiscovery = await window.hearth.refreshLibraryDiscovery(force);
      setData((current) =>
        current ? { ...current, libraryDiscovery } : current
      );
      if (force) {
        setToast(
          libraryDiscovery.state === "ready"
            ? "The discovery shelf is current."
            : libraryDiscovery.message
        );
      }
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "The discovery shelf could not be refreshed.";
      if (force) setToast(message);
    }
  }

  async function importPersonalOsStacks(): Promise<PersonalOsStacksImportResult> {
    try {
      const result = await window.hearth.importPersonalOsStacks();
      const fresh = await window.hearth.bootstrap();
      setData(fresh);
      setToast(
        result.imported
          ? `${result.imported} ${result.imported === 1 ? "link" : "links"} brought over from PersonalOS Stacks.`
          : result.organized
            ? `${result.organized} ${result.organized === 1 ? "link is" : "links are"} back in the original Stacks collections.`
          : "Hearth already has everything active in PersonalOS Stacks."
      );
      return result;
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "PersonalOS Stacks could not be imported.";
      setToast(message);
      throw reason;
    }
  }

  async function setLibraryDiscoveryFeedback(
    discoveryId: string,
    feedback: LibraryDiscoveryFeedback
  ): Promise<void> {
    try {
      const libraryDiscovery =
        await window.hearth.setLibraryDiscoveryFeedback(discoveryId, feedback);
      setData((current) =>
        current ? { ...current, libraryDiscovery } : current
      );
      setToast(
        feedback === "dismissed"
          ? "Hidden from the active shelf. You can restore it under Hidden."
          : feedback === "kept"
            ? "Librarian will remember that this was worth keeping."
            : "Recommendation returned to the active shelf."
      );
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "That discovery preference could not be saved.";
      setToast(message);
      throw reason;
    }
  }

  async function sendAgentMessage(
    agent: AgentKey,
    text: string,
    surface?: AgentSurface,
    libraryCaptureId?: string
  ): Promise<boolean> {
    if (!data) {
      return false;
    }
    const optimisticMessage: ConversationMessage = {
      id: `pending-${crypto.randomUUID()}`,
      agent,
      role: "user",
      text,
      createdAt: new Date().toISOString()
    };
    setData((current) =>
      current
        ? {
            ...current,
            conversations: {
              ...current.conversations,
              [agent]: [...current.conversations[agent], optimisticMessage]
            }
          }
        : current
    );
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    let update: AgentMessageUpdate;
    try {
      update = await window.hearth.sendAgentMessage(
        agent,
        text,
        surface,
        libraryCaptureId
      );
      setData((current) =>
        current
          ? {
              ...current,
              conversations: {
                ...current.conversations,
                [agent]:
                  update.cancelReason === "interrupted"
                    ? current.conversations[agent].filter(
                        (message) => message.id !== optimisticMessage.id
                      )
                    : update.messages
              },
              runtime: {
                ...current.runtime,
                provider: update.provider
              }
            }
          : current
      );
    } catch (reason) {
      setData((current) =>
        current
          ? {
              ...current,
              conversations: {
                ...current.conversations,
                [agent]: current.conversations[agent].filter(
                  (message) => message.id !== optimisticMessage.id
                )
              }
            }
          : current
      );
      setToast(
        reason instanceof Error
          ? reason.message
          : "That message did not reach the conversation."
      );
      return false;
    }
    if (update.cancelled) {
      if (update.cancelReason === "interrupted") {
        return true;
      }
      const name =
        agent === "maker" ? "Maker" : agent === "critic" ? "Critic" : "Librarian";
      setToast(`${name} stopped. Your message is back in the composer.`);
      return false;
    }
    if (agent === "maker" && makerDraft?.text === text) {
      setMakerDraft(null);
    }
    if (
      (agent === "maker" ||
        agent === "companion" ||
        agent === "critic" ||
        agent === "librarian") &&
      update.provider.selection === "claude-code" &&
      (update.provider.residents?.[agent]?.state === "degraded" ||
        update.provider.state === "degraded")
    ) {
      setToast(
        update.provider.lastError
          ? `${update.provider.lastError} Your message is saved.`
          : "That resident could not finish the reply. Your message is saved."
      );
    } else if (
      agent === "critic" &&
      update.provider.residents?.critic.fallbackFrom === "codex"
    ) {
      setToast(
        `Codex was unavailable, so Critic used ${residentProviderLabel(update.provider.residents.critic)} for this reply.`
      );
    }
    return true;
  }

  async function configureMakerSession(control: MakerSessionControl): Promise<boolean> {
    try {
      const state = await window.hearth.configureMakerSession(control);
      setMakerSessionState(state);
      setData((current) => {
        if (!current) return current;
        const turns = current.workshop.turns;
        return {
          ...current,
          workshop: {
            ...current.workshop,
            turns: turns.map((turn, index) =>
              index === turns.length - 1 ? { ...turn, sessionState: state } : turn
            )
          }
        };
      });
      return true;
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Claude could not change that setting.");
      return false;
    }
  }

  async function resetMakerSession(): Promise<void> {
    try {
      await window.hearth.resetMakerSession();
      setMakerSessionState(null);
      setMakerTurnHealth(null);
      setMakerTurnUsage(null);
      setToast("Fresh Maker session ready. Your previous workstream stays in the project history.");
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Maker could not start a fresh session.");
    }
  }

  async function resolveMakerPermission(
    permissionId: string,
    optionId: string
  ): Promise<void> {
    try {
      await window.hearth.resolveMakerPermission(permissionId, optionId);
    } catch (reason) {
      setToast(
        reason instanceof Error
          ? reason.message
          : "That permission request is no longer waiting."
      );
    }
  }

  async function cancelAgentMessage(agent: ReasoningAgent): Promise<void> {
    const result = await window.hearth.cancelAgentMessage(agent);
    if (result.cancelled) {
      const name =
        agent === "maker" ? "Maker" : agent === "critic" ? "Critic" : "Librarian";
      setToast(`Stopping ${name}…`);
    }
  }

  async function prepareMakerProposal(messageId: string): Promise<void> {
    if (!data || proposalBusy) return;
    setProposalBusy(true);
    try {
      const result = await window.hearth.createMakerProposal(messageId);
      setData((current) =>
        current
          ? {
              ...current,
              makerProposal: result.proposal,
              conversations: result.criticHandoff
                ? {
                    ...current.conversations,
                    critic: result.criticHandoff.messages
                  }
                : current.conversations,
              agentContexts: result.criticHandoff
                ? {
                    ...current.agentContexts,
                    critic: result.criticHandoff.context
                  }
                : current.agentContexts,
              runtime: {
                ...current.runtime,
                provider: result.provider
              }
            }
          : current
      );
      setToast(
        result.criticHandoff
          ? "Maker prepared the handoff and brought Critic in to pressure-test it."
          : "Maker prepared a Workshop handoff. Nothing has been passed yet."
      );
      await navigate("workshop");
    } catch (reason) {
      setToast(
        reason instanceof Error
          ? reason.message
          : "Maker could not prepare that handoff."
      );
    } finally {
      setProposalBusy(false);
    }
  }

  async function updateMakerProposal(
    proposalId: string,
    instruction: string
  ): Promise<void> {
    const proposal = await window.hearth.updateMakerProposal(proposalId, instruction);
    setData((current) => (current ? { ...current, makerProposal: proposal } : current));
  }

  async function discardMakerProposal(proposalId: string): Promise<void> {
    await window.hearth.discardMakerProposal(proposalId);
    setData((current) => (current ? { ...current, makerProposal: null } : current));
    setToast("Maker’s handoff was discarded. Nothing was passed.");
  }

  async function completeMakerProposal(proposalId: string): Promise<void> {
    const proposal = await window.hearth.completeMakerProposal(proposalId);
    setData((current) => (current ? { ...current, makerProposal: proposal } : current));
    setToast("Claude Code has the approved instruction. Hearth is waiting for its report.");
  }

  async function closeMakerProposal(proposalId: string): Promise<void> {
    const hadResult = Boolean(data?.makerProposal?.executionResult);
    await window.hearth.closeMakerProposal(proposalId);
    setData((current) => (current ? { ...current, makerProposal: null } : current));
    setToast(
      hadResult
        ? "The execution report was put away."
        : "Hearth stopped waiting for a report. Claude Code is still running."
    );
  }

  async function handoffExecutionResultToCritic(proposalId: string): Promise<void> {
    const update = await window.hearth.handoffExecutionResultToCritic(proposalId);
    setData((current) =>
      current
        ? {
            ...current,
            makerProposal: update.proposal,
            conversations: { ...current.conversations, critic: update.messages },
            agentContexts: { ...current.agentContexts, critic: update.context }
          }
        : current
    );
    setStudyView("critic");
    await navigate("study");
    setToast("The execution report and current Git diff were handed to Critic.");
  }

  async function openCritic(): Promise<void> {
    setStudyView("critic");
    await navigate("study");
  }

  async function setAgentProvider(selection: AgentProviderSelection): Promise<void> {
    if (!data || data.runtime.provider.selection === selection) return;
    try {
      const provider = await window.hearth.setAgentProvider(selection);
      setData({
        ...data,
        runtime: {
          ...data.runtime,
          provider
        }
      });
      setToast(
        selection === "claude-code"
          ? provider.available
            ? "The household will use bounded Claude Code reasoning."
            : "Claude Code was not found. Local replies remain available."
          : "The household is answering locally."
      );
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "The provider could not be changed.");
    }
  }

  async function setAgentContext(
    agent: ContextAgent,
    project: WorkspaceProjectSummary,
    kind: AgentContextKind,
    projectPath?: string,
    projectPaths?: string[]
  ): Promise<void> {
    if (!data) return;
    try {
      const update = await window.hearth.setAgentContext(
        agent,
        project.id,
        kind,
        projectPath,
        projectPaths
      );
      setData({
        ...data,
        conversations: {
          ...data.conversations,
          [agent]: update.messages
        },
        agentContexts: {
          ...data.agentContexts,
          [agent]: update.context
        }
      });
      setStudyView(agent === "maker" ? "brief" : "critic");
      const contextLabel = projectPaths?.length
        ? ` · ${projectPaths.length} selected files`
        : projectPath
          ? ` · ${projectPath}`
          : "";
      setToast(
        `${project.name}${contextLabel} sent to ${agent === "maker" ? "Maker" : "Critic"}.`
      );
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "That handoff could not be created.");
    }
  }

  async function updateObjective(objective: string): Promise<void> {
    if (!data) {
      return;
    }
    const state: ProjectState = await window.hearth.updateObjective(objective);
    setData({ ...data, state });
    setToast("Objective updated.");
  }

  async function workInProject(project: WorkspaceProjectSummary): Promise<void> {
    if (!data || projectActivationBusyRef.current) {
      return;
    }
    projectActivationBusyRef.current = true;
    setProjectActivationBusy(true);
    try {
      const activation = await window.hearth.activateWorkspaceProject(project.id);
      const state = await window.hearth.setRoute("workshop");
      const fresh = await window.hearth.bootstrap();
      setData({
        ...fresh,
        state,
        workspace: {
          selectedProject: activation.project
        },
        terminal: activation.terminal
      });
      const parkedName = activation.parkedProjectRoot
        ?.split(/[\\/]/)
        .filter(Boolean)
        .at(-1);
      const targetSession = activation.terminal.session;
      const targetReadyToResume = Boolean(
        targetSession?.kind === "claude" &&
        targetSession.claudeSessionId &&
        targetSession.claudeResumable
      );
      setToast(
        parkedName
          ? `${parkedName} is parked. ${activation.project.name} is current${targetReadyToResume ? " and ready to resume" : ""}.`
          : `${activation.project.name} is now the working project${targetReadyToResume ? " and its Claude session is ready to resume" : ""}.`
      );
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "That project could not be selected.");
    } finally {
      projectActivationBusyRef.current = false;
      setProjectActivationBusy(false);
    }
  }

  async function leave(note?: string): Promise<void> {
    if (!data) {
      return;
    }
    const returnPack = await window.hearth.leaveProject(note);
    const state = await window.hearth.setRoute("home");
    const fresh = await window.hearth.bootstrap();
    setData({
      ...fresh,
      state,
      returnPack
    });
    setLeaveOpen(false);
    setToast("Return Pack saved. The house will remember the truth.");
  }

  if (error) {
    return <ErrorScreen message={error} onRetry={() => void load()} />;
  }

  if (!data) {
    return <LoadingScreen />;
  }

  return (
    <div
      className={classNames("app-shell", workshopFocus && "is-workshop-focus")}
      data-room={route}
    >
      {!workshopFocus ? (
        <Sidebar
          route={route}
          onNavigate={(next) => {
            setFocusedCaptureId(null);
            if (next === "study") {
              setStudyView("projects");
            }
            void navigate(next);
          }}
          liveProcesses={data.runtime.liveProcesses}
        />
      ) : null}
      <div className="app-main">
        {!workshopFocus ? (
          <Topbar
            projectName={projectName}
            onProject={() => {
              setFocusedCaptureId(null);
              setStudyView("projects");
              void navigate("study");
            }}
            onCapture={capture}
            onSearch={() => void openSearch()}
            onLeave={() => setLeaveOpen(true)}
          />
        ) : null}
        {route === "home" ? (
          <HomeRoom
            data={data}
            onNavigate={(next) => void navigate(next)}
            historicalPack={historicalReturnPack}
            onCloseHistoricalPack={() => setHistoricalReturnPack(null)}
            houseMemoryOpenRequest={houseMemoryOpenRequest}
            onHouseMemoryOpenRequestHandled={() =>
              setHouseMemoryOpenRequest(0)
            }
            onHouseMemoryChange={(houseMemory) =>
              setData((current) =>
                current ? { ...current, houseMemory } : current
              )
            }
            onNotify={setToast}
            onGather={() => void gatherInLivingRoom({
              kind: "house",
              label: "Home · household check-in",
              summary: `A general household discussion while ${data.workspace.selectedProject.name} is current. No private resident chat or terminal output was brought in.`,
              sourceId: null
            })}
          />
        ) : route === "living" ? (
          <LivingRoom
            data={data}
            onSnapshotChange={applyLivingRoomSnapshot}
            onSaveDecision={saveLivingRoomDecision}
            onDraftDecision={draftLivingRoomDecision}
          />
        ) : route === "library" ? (
          <LibraryRoom
            data={data}
            onSend={sendAgentMessage}
            onCapture={capture}
            onUpdate={updateCapture}
            onEnrich={enrichCapture}
            onRefreshDiscovery={refreshLibraryDiscovery}
            onDiscoveryFeedback={setLibraryDiscoveryFeedback}
            onImportPersonalOsStacks={importPersonalOsStacks}
            onCancel={() => cancelAgentMessage("librarian")}
            onNotify={setToast}
            focusCaptureId={focusedCaptureId}
            onGather={(item) => void gatherInLivingRoom({
              kind: "library",
              label: item.title ?? item.domain ?? "Library item",
              summary: [
                item.description,
                item.reference
                  ? `${item.reference.kind} · ${item.reference.canonicalUrl} · ${item.reference.metadataState === "retrieved" ? "public details retrieved" : "details unverified"}`
                  : item.text,
                item.tags.length ? `Tags: ${item.tags.join(", ")}` : null
              ]
                .filter(Boolean)
                .join("\n")
                .slice(0, 4_000),
              sourceId: item.id
            }, ["librarian", "maker", "critic"])}
          />
        ) : route === "studio" ? (
          <StudioRoom
            data={data}
            onCapture={capture}
            onUpdate={updateCapture}
            onIdeaMessage={sendIdeaMessage}
            onPromote={promoteIdea}
            onOpenProject={openProjectInStudy}
            onCancelMaker={() => cancelAgentMessage("maker")}
            onNotify={setToast}
            makerStream={agentStreams.maker}
            focusCaptureId={focusedCaptureId}
          />
        ) : route === "archive" ? (
          <Suspense fallback={<LoadingScreen />}>
            <ArchiveRoom
              onUpdateCapture={updateCapture}
              onRemoveArchiveItem={removeArchiveItem}
              onNavigate={(next) => void navigate(next)}
              onNotify={setToast}
              currentProject={data.workspace.selectedProject}
              terminalLive={Boolean(
                data.terminal.session &&
                  ["starting", "running", "waiting"].includes(
                    data.terminal.session.lifecycle
                  )
              )}
              onOpenReturnPack={openArchivedReturnPack}
              onOrientProject={orientFromArchive}
            />
          </Suspense>
        ) : route === "study" ? (
          <StudyRoom
            data={data}
            onSend={sendAgentMessage}
            onUpdateObjective={updateObjective}
            onNavigate={(next) => void navigate(next)}
            onWorkHere={workInProject}
            projectActivationBusy={projectActivationBusy}
            onCapture={capture}
            onUpdateCapture={updateCapture}
            onOpenNote={(captureId) => {
              setFocusedCaptureId(captureId);
              void navigate("studio");
            }}
            onSetAgentContext={setAgentContext}
            onNotify={setToast}
            onSetProvider={setAgentProvider}
            streams={agentStreams}
            onCancelAgent={cancelAgentMessage}
            onStageMaker={(messageId) => void prepareMakerProposal(messageId)}
            proposalBusy={proposalBusy}
            view={studyView}
            onView={setStudyView}
            projectOrientation={projectOrientation}
            makerDraft={makerDraft?.destination === "study" ? makerDraft : null}
            onGather={() => {
              const context = studyView === "critic"
                ? data.agentContexts.critic
                : data.agentContexts.maker;
              void gatherInLivingRoom({
                kind: studyView === "critic" ? "critic" : "project",
                label: studyView === "critic" ? "Critic's current review" : `${data.workspace.selectedProject.name} · Study`,
                summary: [
                  `Objective: ${data.state.objective}`,
                  context ? `Selected evidence: ${context.summary}` : "No specific file evidence selected."
                ].join("\n"),
                sourceId: context?.id ?? data.workspace.selectedProject.id
              });
            }}
          />
        ) : (
          <Suspense fallback={<LoadingScreen />}>
            <WorkshopRoom
              data={data}
              focusMode={workshopFocus}
              onFocusMode={setWorkshopFocus}
              shelfCollapsed={workshopShelfCollapsed}
              onShelfCollapsed={setWorkshopShelfCollapsed}
              onTerminalSnapshot={applyTerminalSnapshot}
              onStart={startTerminal}
              onResume={resumeTerminal}
              onStop={stopTerminal}
              onOwner={setTerminalOwner}
              onInstruction={passTerminalInstruction}
              onTalk={(text) => sendAgentMessage("maker", text, "resident")}
              onConfigureSession={configureMakerSession}
              stream={agentStreams.maker}
              workRequestId={makerWorkRequestId}
              workActivities={makerWorkActivities}
              workPlan={makerWorkPlan}
              thoughts={makerThoughts}
              sessionState={makerSessionState}
              turnHealth={makerTurnHealth}
              turnUsage={makerTurnUsage}
              contextManifest={makerContextManifest}
              permissions={makerPermissions}
              working={makerWorking}
              onResolvePermission={resolveMakerPermission}
              onCancelAgent={() => cancelAgentMessage("maker")}
              onStartFresh={resetMakerSession}
              onPrepareReturnPack={() => setLeaveOpen(true)}
              proposal={data.makerProposal}
              onUpdateProposal={updateMakerProposal}
              onDiscardProposal={discardMakerProposal}
              onCompleteProposal={completeMakerProposal}
              onCloseProposal={closeMakerProposal}
              onCriticProposal={handoffExecutionResultToCritic}
              onOpenCritic={openCritic}
              onNotify={setToast}
              onReturnToTerminalProject={returnToTerminalProject}
              onParkAndOpenSelectedProject={parkTerminalAndOpenSelectedProject}
              initialDraft={makerDraft?.destination === "workshop" ? makerDraft : null}
              onGather={() => {
                const latest = data.workshop.turns.at(-1);
                void gatherInLivingRoom({
                  kind: "workshop",
                  label: `${data.workspace.selectedProject.name} · Workshop`,
                  summary: latest
                    ? `Latest direction: ${latest.prompt}\nStatus: ${latest.status}. Technical activity and terminal output were not brought into the room.`
                    : "No managed Maker turn has run yet. Terminal output is not included.",
                  sourceId: latest?.id ?? data.workspace.selectedProject.id
                });
              }}
            />
          </Suspense>
        )}
      </div>
      {!workshopFocus && route === "home" ? (
        <Companion
          messages={companionMessages}
          providerLabel={
            agentProviderLabel(data, "companion")
          }
          onSend={sendAgentMessage}
        />
      ) : null}
      {leaveOpen ? <LeaveDialog onClose={() => setLeaveOpen(false)} onLeave={leave} /> : null}
      {searchOpen ? (
        <HearthSearch
          captures={data.captures}
          catalog={searchCatalog}
          memories={data.houseMemory.active}
          onClose={() => setSearchOpen(false)}
          onOpen={(result) => void openSearchResult(result)}
        />
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
