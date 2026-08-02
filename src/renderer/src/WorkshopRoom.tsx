import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import type {
  BootstrapData,
  ConversationMessage,
  MakerPermissionRequest,
  MakerProposal,
  MakerSessionControl,
  MakerSessionState,
  MakerWorkActivity,
  MakerWorkPlanEntry,
  TerminalEvent,
  TerminalObservation,
  TerminalKind,
  TerminalOwner,
  TerminalSession,
  TerminalSnapshot,
  WorkshopTurn
} from "../../shared/contracts";
import { ResidentAvatar } from "./ResidentAvatar";

const LIVE_STATES = new Set(["starting", "running", "waiting"]);

function submitChatOnEnter(event: KeyboardEvent<HTMLTextAreaElement>): void {
  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

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

function sessionLabel(session: TerminalSession | null): string {
  if (!session) {
    return "No session";
  }
  if (session.kind === "claude") {
    return session.claudeName ?? "Claude Code";
  }
  return "PowerShell";
}

function sameProjectPath(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  const normalize = (value: string) => value.replaceAll("\\", "/").replace(/\/+$/, "").toLocaleLowerCase();
  return normalize(left) === normalize(right);
}

function providerLines(label: string): { family: string | null; model: string } {
  const match = label.match(/^(Claude)\s+(.+)$/i);
  return match
    ? { family: match[1] ?? "Claude", model: match[2] ?? label }
    : { family: null, model: label };
}

function activityGlyph(kind: MakerWorkActivity["kind"]): string {
  if (kind === "execute") return ">_";
  if (kind === "edit") return "✎";
  if (kind === "read" || kind === "search") return "⌕";
  if (kind === "fetch") return "↗";
  if (kind === "think") return "…";
  if (kind === "switch_mode") return "↻";
  return "·";
}

function formatTokenCount(value: number): string {
  if (value < 1_000) return value.toLocaleString();
  if (value < 10_000) return `${(value / 1_000).toFixed(1)}k`;
  if (value < 1_000_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return `${(value / 1_000_000).toFixed(1)}m`;
}

function makerModeLabel(state: MakerSessionState | null): string {
  if (state?.modeId === "auto") return "Auto";
  if (state?.modeId === "plan") return "Planning";
  return "Manual";
}

function visibleDiff(oldText: string | null, newText: string): string {
  const before = (oldText ?? "").split("\n");
  const after = newText.split("\n");
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const removed = before.slice(prefix, before.length - suffix).map((line) => `- ${line}`);
  const added = after.slice(prefix, after.length - suffix).map((line) => `+ ${line}`);
  const lead = before.slice(Math.max(0, prefix - 2), prefix).map((line) => `  ${line}`);
  const tail = after
    .slice(after.length - suffix, after.length - suffix + 2)
    .map((line) => `  ${line}`);
  const lines = [...lead, ...removed, ...added, ...tail];
  return lines.length <= 320
    ? lines.join("\n")
    : `${lines.slice(0, 320).join("\n")}\n…diff trimmed by Hearth`;
}

function WorkDetailBlock({
  label,
  text,
  className = ""
}: {
  label: string;
  text: string;
  className?: string;
}): ReactNode {
  return (
    <section className={className}>
      <header>
        <span>{label}</span>
        <button
          type="button"
          title={`Copy ${label}`}
          onClick={() => void window.hearth.writeClipboard(text)}
        >
          Copy
        </button>
      </header>
      <pre>{text}</pre>
    </section>
  );
}

function DiffDetailBlock({
  path,
  oldText,
  newText
}: {
  path: string;
  oldText: string | null;
  newText: string;
}): ReactNode {
  const diff = visibleDiff(oldText, newText);
  return (
    <section className="managed-diff">
      <header>
        <span>{path}</span>
        <button
          type="button"
          title="Copy diff"
          onClick={() => void window.hearth.writeClipboard(diff)}
        >
          Copy
        </button>
      </header>
      <pre>
        {diff.split("\n").map((line, index) => (
          <span
            className={
              line.startsWith("+")
                ? "managed-diff-line is-added"
                : line.startsWith("-")
                  ? "managed-diff-line is-removed"
                  : "managed-diff-line"
            }
            key={`${index}-${line}`}
          >
            {line || " "}
          </span>
        ))}
      </pre>
    </section>
  );
}

function TerminalViewport({
  session,
  focusRequest,
  onSession,
  onError
}: {
  session: TerminalSession;
  focusRequest: number;
  onSession: (session: TerminalSession | null) => void;
  onError: (message: string) => void;
}): ReactNode {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const ownerRef = useRef(session.owner);
  const lifecycleRef = useRef(session.lifecycle);
  const onSessionRef = useRef(onSession);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    ownerRef.current = session.owner;
    lifecycleRef.current = session.lifecycle;
    onSessionRef.current = onSession;
    onErrorRef.current = onError;
  }, [onError, onSession, session.owner, session.lifecycle]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let disposed = false;
    let attached = false;
    let lastSequence = -1;
    const pending: Extract<TerminalEvent, { type: "output" }>[] = [];
    const terminal = new Terminal({
      allowProposedApi: false,
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, monospace",
      fontSize: 14,
      fontWeight: "400",
      fontWeightBold: "600",
      lineHeight: 1.18,
      letterSpacing: 0,
      screenReaderMode: true,
      scrollback: 5_000,
      smoothScrollDuration: 90,
      theme: {
        background: "#151217",
        foreground: "#eadfd2",
        cursor: "#e9a66f",
        cursorAccent: "#151217",
        selectionBackground: "#8e5d4f66",
        black: "#201a20",
        red: "#e07c75",
        green: "#9fba86",
        yellow: "#d8b36d",
        blue: "#7fa9bd",
        magenta: "#b78ca8",
        cyan: "#79b7b0",
        white: "#e9dfd3",
        brightBlack: "#72676e",
        brightRed: "#ef948c",
        brightGreen: "#b4cc9b",
        brightYellow: "#e7c683",
        brightBlue: "#98bed0",
        brightMagenta: "#caa3bd",
        brightCyan: "#94cbc4",
        brightWhite: "#fff8ee"
      }
    });
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    searchAddonRef.current = searchAddon;
    const openLink = (event: MouseEvent, uri: string) => {
      if (!event.ctrlKey) {
        onErrorRef.current("Hold Ctrl while clicking a terminal link.");
        return;
      }
      void window.hearth.openExternal(uri).catch((reason: unknown) => {
        onErrorRef.current(
          reason instanceof Error ? reason.message : "That link could not be opened."
        );
      });
    };
    const linksAddon = new WebLinksAddon(openLink);
    terminal.options.linkHandler = {
      activate: openLink,
      allowNonHttpProtocols: false
    };
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(linksAddon);
    terminal.open(host);
    terminalRef.current = terminal;

    const focusForTyping = () => {
      if (
        ownerRef.current === "user" &&
        LIVE_STATES.has(lifecycleRef.current)
      ) {
        terminal.focus();
      }
    };
    const handleTerminalPointerDown = (event: PointerEvent) => {
      if (event.button === 0) {
        focusForTyping();
      }
    };
    host.addEventListener("pointerdown", handleTerminalPointerDown);

    const writeOutput = (event: Extract<TerminalEvent, { type: "output" }>) => {
      if (
        event.sessionId !== session.id ||
        event.sequence <= lastSequence ||
        disposed
      ) {
        return;
      }
      lastSequence = event.sequence;
      terminal.write(event.data);
    };

    const removeTerminalListener = window.hearth.onTerminalEvent((event) => {
      if (event.type === "state") {
        onSessionRef.current(event.session);
        return;
      }
      if (event.type !== "output") {
        return;
      }
      if (!attached) {
        pending.push(event);
        return;
      }
      writeOutput(event);
    });

    const dataDisposable = terminal.onData((data) => {
      if (
        ownerRef.current !== "user" ||
        !LIVE_STATES.has(lifecycleRef.current)
      ) {
        return;
      }
      void window.hearth.terminalInput(session.id, data).catch((reason: unknown) => {
        onErrorRef.current(
          reason instanceof Error ? reason.message : "The terminal rejected that input."
        );
      });
    });

    const pasteClipboard = () => {
      void window.hearth.readClipboard().then((text) => {
        if (
          text &&
          ownerRef.current === "user" &&
          LIVE_STATES.has(lifecycleRef.current)
        ) {
          return window.hearth.terminalInput(session.id, text);
        }
        return undefined;
      });
    };
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (terminal.hasSelection()) {
        void window.hearth
          .writeClipboard(terminal.getSelection())
          .catch((reason: unknown) =>
            onErrorRef.current(
              reason instanceof Error ? reason.message : "The selection could not be copied."
            )
          );
        terminal.clearSelection();
        return;
      }
      pasteClipboard();
    };
    host.addEventListener("contextmenu", handleContextMenu);

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }
      if (
        ((event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") ||
          (event.ctrlKey && event.key === "Insert")) &&
        terminal.hasSelection()
      ) {
        void window.hearth
          .writeClipboard(terminal.getSelection())
          .catch((reason: unknown) =>
            onErrorRef.current(
              reason instanceof Error ? reason.message : "The selection could not be copied."
            )
          );
        return false;
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        setSearchOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
        return false;
      }
      return true;
    });

    let resizeFrame: number | null = null;
    let lastSize = "";
    const fitAndResize = () => {
      if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        if (disposed || host.clientWidth === 0 || host.clientHeight === 0) {
          return;
        }
        try {
          fitAddon.fit();
          const nextSize = `${terminal.cols}x${terminal.rows}`;
          if (nextSize !== lastSize && LIVE_STATES.has(lifecycleRef.current)) {
            lastSize = nextSize;
            void window.hearth.terminalResize(
              session.id,
              terminal.cols,
              terminal.rows
            );
          }
        } catch {
          // A navigation can collapse the viewport during the resize callback.
        }
      });
    };
    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(host);
    requestAnimationFrame(fitAndResize);

    void window.hearth
      .attachTerminal()
      .then((snapshot) => {
        if (disposed) {
          return;
        }
        onSessionRef.current(snapshot.session);
        if (snapshot.session?.id !== session.id) {
          attached = true;
          return;
        }
        if (snapshot.truncated) {
          terminal.writeln("\x1b[38;2;216;179;109m[Earlier output was trimmed by Hearth]\x1b[0m");
        }
        terminal.write(snapshot.scrollback);
        lastSequence = snapshot.sequence;
        attached = true;
        for (const event of pending) {
          writeOutput(event);
        }
        pending.length = 0;
        focusForTyping();
        fitAndResize();
      })
      .catch((reason: unknown) => {
        onErrorRef.current(
          reason instanceof Error ? reason.message : "The terminal could not attach."
        );
      });

    return () => {
      disposed = true;
      if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame);
      }
      resizeObserver.disconnect();
      dataDisposable.dispose();
      removeTerminalListener();
      host.removeEventListener("contextmenu", handleContextMenu);
      host.removeEventListener("pointerdown", handleTerminalPointerDown);
      searchAddonRef.current = null;
      terminalRef.current = null;
      terminal.dispose();
      void window.hearth.detachTerminal();
    };
  }, [session.id]);

  useEffect(() => {
    if (
      focusRequest <= 0 ||
      session.owner !== "user" ||
      !LIVE_STATES.has(session.lifecycle)
    ) {
      return;
    }
    const frame = requestAnimationFrame(() => terminalRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, session.lifecycle, session.owner]);

  function search(direction: "next" | "previous"): void {
    const input = searchRef.current;
    const searchAddon = searchAddonRef.current;
    if (!searchAddon || !input?.value) {
      return;
    }
    const options = {
      decorations: {
        matchBackground: "#594038",
        matchOverviewRuler: "#c8794d",
        activeMatchBackground: "#c8794d",
        activeMatchColorOverviewRuler: "#f2c08c"
      }
    };
    if (direction === "next") {
      searchAddon.findNext(input.value, options);
    } else {
      searchAddon.findPrevious(input.value, options);
    }
  }

  return (
    <div className="terminal-stage">
      {searchOpen ? <div className="terminal-search">
        <label htmlFor="terminal-search-input">Find</label>
        <input
          id="terminal-search-input"
          ref={searchRef}
          placeholder="Search output"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSearchOpen(false);
              terminalRef.current?.focus();
            } else if (event.key === "Enter") {
              search(event.shiftKey ? "previous" : "next");
            }
          }}
        />
        <button type="button" onClick={() => search("previous")} aria-label="Previous match">
          ↑
        </button>
        <button type="button" onClick={() => search("next")} aria-label="Next match">
          ↓
        </button>
        <button
          className="terminal-search-close"
          type="button"
          onClick={() => {
            setSearchOpen(false);
            terminalRef.current?.focus();
          }}
          aria-label="Close terminal search"
        >
          ×
        </button>
      </div> : null}
      <div
        className="terminal-host"
        ref={hostRef}
        aria-label={`${sessionLabel(session)} terminal`}
      />
      {session.owner === "maker" && LIVE_STATES.has(session.lifecycle) ? (
        <div className="terminal-lock">
          <span>Maker can read the recent terminal</span>
          <small>Instructions still use an explicit handoff. You can watch, copy, and search.</small>
        </div>
      ) : null}
    </div>
  );
}

function MakerRail({
  messages,
  session,
  observation,
  providerLabel,
  providerOnline,
  stream,
  proposal,
  onUpdateProposal,
  onDiscardProposal,
  onCompleteProposal,
  onCloseProposal,
  onCriticProposal,
  onOpenCritic,
  onTalk,
  onCancel,
  onInstruction,
  onNotify,
  busy,
  managed = false,
  managedStatus = "Ready when you are."
}: {
  messages: ConversationMessage[];
  session: TerminalSession | null;
  observation: TerminalObservation;
  providerLabel: string;
  providerOnline: boolean;
  stream: { requestId: string; text: string } | null;
  proposal: MakerProposal | null;
  onUpdateProposal: (proposalId: string, instruction: string) => Promise<void>;
  onDiscardProposal: (proposalId: string) => Promise<void>;
  onCompleteProposal: (proposalId: string) => Promise<void>;
  onCloseProposal: (proposalId: string) => Promise<void>;
  onCriticProposal: (proposalId: string) => Promise<void>;
  onOpenCritic: () => Promise<void>;
  onTalk: (text: string) => Promise<boolean>;
  onCancel: () => Promise<void>;
  onInstruction: (text: string) => Promise<void>;
  onNotify: (message: string) => void;
  busy: boolean;
  managed?: boolean;
  managedStatus?: string;
}): ReactNode {
  const [message, setMessage] = useState("");
  const [proposalInstruction, setProposalInstruction] = useState(
    proposal?.instruction ?? ""
  );
  const [proposalSaving, setProposalSaving] = useState(false);
  const [followLatest, setFollowLatest] = useState(true);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const canRelay =
    session?.kind === "claude" &&
    session.owner === "maker" &&
    LIVE_STATES.has(session.lifecycle);
  const preflightConsultation = proposal?.consultations.find(
    (consultation) => consultation.phase === "preflight"
  );
  const postflightConsultation = proposal?.consultations.find(
    (consultation) => consultation.phase === "postflight"
  );
  const provider = providerLines(providerLabel);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList || !followLatest) return;
    messageList.scrollTop = messageList.scrollHeight;
    messageList.scrollLeft = 0;
  }, [messages, busy, stream?.text, followLatest]);

  useEffect(() => {
    setProposalInstruction(proposal?.instruction ?? "");
  }, [proposal?.id, proposal?.instruction]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = message.trim();
    if (!value || busy) {
      return;
    }
    setMessage("");
    setFollowLatest(true);
    const completed = await onTalk(value);
    if (!completed) {
      setMessage(value);
    }
  }

  async function saveProposal(): Promise<boolean> {
    if (!proposal) return false;
    const value = proposalInstruction.trim();
    if (!value) return false;
    if (value === proposal.instruction) return true;
    setProposalSaving(true);
    try {
      await onUpdateProposal(proposal.id, value);
      return true;
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : "The handoff could not be saved.");
      return false;
    } finally {
      setProposalSaving(false);
    }
  }

  async function discardProposal(): Promise<void> {
    if (!proposal) return;
    try {
      await onDiscardProposal(proposal.id);
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : "The handoff could not be discarded.");
    }
  }

  async function passInstruction(): Promise<void> {
    const value = proposalInstruction.trim();
    if (!proposal || !value || busy || proposalSaving || !canRelay) {
      return;
    }
    const saved = await saveProposal();
    if (!saved) return;
    try {
      await onInstruction(value);
      await onCompleteProposal(proposal.id);
    } catch (reason) {
      onNotify(
        reason instanceof Error
          ? reason.message
          : "The instruction or its approval record could not be completed."
      );
    }
  }

  async function closeProposal(): Promise<void> {
    if (!proposal) return;
    try {
      await onCloseProposal(proposal.id);
    } catch (reason) {
      onNotify(
        reason instanceof Error ? reason.message : "The execution report could not be closed."
      );
    }
  }

  return (
    <aside className={`workshop-maker${managed ? " workshop-maker--managed" : ""}`}>
      <div className="maker-rail-heading">
        <ResidentAvatar resident="maker" mood={busy ? "thinking" : "present"} />
        <div className="maker-heading-copy">
          <p className="eyebrow">At the workbench</p>
          <h2>Maker</h2>
        </div>
        <div
          className={`maker-status${providerOnline ? " maker-status--online" : ""}`}
          aria-label={`${providerLabel} · ${providerOnline ? "online" : "local"}`}
          title={`${providerLabel} · ${providerOnline ? "online" : "local"}`}
        >
          <small className="maker-provider">
            {provider.family ? <span>{provider.family}</span> : null}
            <strong>{provider.model}</strong>
          </small>
          <span className="presence-dot" aria-hidden="true" />
        </div>
      </div>
      <div className={managed ? "maker-work-status" : "maker-context"}>
        {managed ? <span className={`presence-dot${busy ? " is-working" : ""}`} aria-hidden="true" /> : null}
        <strong>
          {managed
            ? busy
              ? managedStatus
              : "Ready when you are."
            : observation.requiresInput
            ? "You’re needed."
            : session
            ? session.owner === "maker"
              ? "I can see the terminal."
              : "I’m alongside you."
            : "Nothing is running yet."}
        </strong>
        {managed ? (
          <small>{busy ? "Working in the Claude session" : "Conversation stays here. Work stays beside me."}</small>
        ) : session ? (
          <div className="maker-runtime-line">
            <span className={`observation-state observation-state--${observation.state}`}>
              {observation.state}
            </span>
            <p className="observation-summary">{observation.summary}</p>
          </div>
        ) : (
          <p>Start Claude Code when you want me involved in the working session.</p>
        )}
      </div>
      <div
        className="maker-rail-messages"
        ref={messageListRef}
        onScroll={(event) => {
          const target = event.currentTarget;
          setFollowLatest(target.scrollHeight - target.scrollTop - target.clientHeight < 48);
        }}
      >
        {messages.slice(-40).map((item) => (
          <article
            className={
              item.role === "user"
                ? `maker-note maker-note--user${item.id.startsWith("pending-") ? " maker-note--pending" : ""}`
                : "maker-note"
            }
            key={item.id}
          >
            <div>
              <strong>{item.role === "user" ? "You" : "Maker"}</strong>
              <span>
                {item.id.startsWith("pending-")
                  ? "sending"
                  : formatTime(item.createdAt)}
              </span>
            </div>
            <p>{item.text}</p>
          </article>
        ))}
        {stream?.text ? (
          <article className="maker-note maker-note--streaming">
            <div>
              <strong>Maker</strong>
              <span>writing</span>
            </div>
            <p>{stream.text}<span className="stream-caret" aria-hidden="true" /></p>
          </article>
        ) : busy ? <div className="maker-thinking">Maker is thinking…</div> : null}
        <div />
      </div>
      {!followLatest ? (
        <button
          className="maker-jump-latest"
          type="button"
          onClick={() => {
            const messageList = messageListRef.current;
            if (messageList) messageList.scrollTop = messageList.scrollHeight;
            setFollowLatest(true);
          }}
        >
          Latest ↓
        </button>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {busy ? "Maker is working" : stream?.text ? "Maker is replying" : ""}
      </span>
      {!managed && proposal?.status === "draft" ? (
        <section className="maker-proposal" aria-labelledby="maker-proposal-title">
          <div className="maker-proposal-heading">
            <div>
              <p className="eyebrow">Ready for your review</p>
              <h3 id="maker-proposal-title">Workshop handoff</h3>
            </div>
            <span className={`proposal-risk proposal-risk--${proposal.risk}`}>
              {proposal.risk} risk
            </span>
          </div>
          <p className="proposal-rationale">{proposal.rationale}</p>
          <div className="proposal-scope">
            <strong>Expected scope</strong>
            {proposal.expectedFiles.length ? (
              <div>
                {proposal.expectedFiles.map((file) => (
                  <span key={file}>{file}</span>
                ))}
              </div>
            ) : (
              <small>No specific files confirmed yet.</small>
            )}
          </div>
          <div className="proposal-approval">
            <strong>Approval note</strong>
            <p>{proposal.riskSummary}</p>
          </div>
          {preflightConsultation ? (
            <div className="resident-consultation">
              <div>
                <span aria-hidden="true">C</span>
                <p>
                  <strong>Critic joined the review</strong>
                  <small>{preflightConsultation.note}</small>
                </p>
              </div>
              <button type="button" onClick={() => void onOpenCritic()}>
                Open Critic
              </button>
            </div>
          ) : null}
          <label htmlFor="workshop-proposal-instruction">Instruction for Claude Code</label>
          <textarea
            id="workshop-proposal-instruction"
            wrap="soft"
            value={proposalInstruction}
            onChange={(event) => setProposalInstruction(event.target.value)}
            onBlur={() => void saveProposal()}
            maxLength={8_000}
          />
          <div className="proposal-actions">
            <button
              className="small-button small-button--quiet"
              type="button"
              disabled={proposalSaving}
              onClick={() => void discardProposal()}
            >
              Discard
            </button>
            <button
              className="small-button small-button--quiet"
              type="button"
              disabled={
                proposalSaving ||
                !proposalInstruction.trim() ||
                proposalInstruction.trim() === proposal.instruction
              }
              onClick={() => void saveProposal()}
            >
              {proposalSaving ? "Saving…" : "Save changes"}
            </button>
            <button
              className="small-button"
              type="button"
              disabled={!proposalInstruction.trim() || busy || proposalSaving || !canRelay}
              onClick={() => void passInstruction()}
              title={
                canRelay
                  ? "Pass this reviewed instruction into Claude Code"
                  : "Give Maker control of a running Claude Code session first"
              }
            >
              Pass to Claude
            </button>
          </div>
        </section>
      ) : !managed && proposal?.status === "passed" ? (
        <section
          className={`maker-proposal maker-proposal--execution${proposal.executionResult ? " maker-proposal--reported" : ""}`}
          aria-labelledby="maker-execution-title"
        >
          <div className="maker-proposal-heading">
            <div>
              <p className="eyebrow">
                {proposal.executionResult ? "Returned from Claude Code" : "In the terminal"}
              </p>
              <h3 id="maker-execution-title">
                {proposal.executionResult ? "Execution report" : "Work in progress"}
              </h3>
            </div>
            <span className={`execution-status${proposal.executionResult ? " is-reported" : ""}`}>
              {proposal.executionResult ? "Reported" : "Waiting"}
            </span>
          </div>
          {proposal.executionResult ? (
            <>
              <div className="execution-section proposal-scope">
                <strong>Changed files</strong>
                {proposal.executionResult.changedFiles.length ? (
                  <div>
                    {proposal.executionResult.changedFiles.map((file) => (
                      <span key={file}>{file}</span>
                    ))}
                  </div>
                ) : (
                  <small>Claude Code reported no changed files.</small>
                )}
              </div>
              <div className="execution-corroboration">
                <div>
                  <strong>Git corroboration</strong>
                  <span className={`corroboration-state is-${proposal.executionResult.corroboration?.status ?? "checking"}`}>
                    {proposal.executionResult.corroboration?.status ?? "checking"}
                  </span>
                </div>
                {proposal.executionResult.corroboration ? (
                  <>
                    <p>
                      {proposal.executionResult.corroboration.matchedFiles.length} reported
                      {proposal.executionResult.corroboration.matchedFiles.length === 1 ? " path is" : " paths are"} visible
                      in the current Git working tree.
                    </p>
                    {proposal.executionResult.corroboration.missingReportedFiles.length ? (
                      <small>
                        Not visible in Git: {proposal.executionResult.corroboration.missingReportedFiles.join(", ")}
                      </small>
                    ) : null}
                    {proposal.executionResult.corroboration.additionalObservedFiles.length ? (
                      <small>
                        Additional current changes: {proposal.executionResult.corroboration.additionalObservedFiles.join(", ")}
                      </small>
                    ) : null}
                  </>
                ) : (
                  <p>Checking the report against the current working tree…</p>
                )}
                <em>Git confirms current paths, not which agent changed them.</em>
              </div>
              <div className="execution-section">
                <strong>Validation performed</strong>
                {proposal.executionResult.validation.length ? (
                  <ul>
                    {proposal.executionResult.validation.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No validation was reported.</p>
                )}
              </div>
              <div className="execution-section">
                <strong>Unresolved concerns</strong>
                {proposal.executionResult.concerns.length ? (
                  <ul>
                    {proposal.executionResult.concerns.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Nothing unresolved was reported.</p>
                )}
              </div>
              <div className="execution-decision">
                <strong>Decision needed</strong>
                <p>
                  {proposal.executionResult.decision ||
                    "Claude Code did not request another decision."}
                </p>
              </div>
              {postflightConsultation ? (
                <div className="resident-consultation">
                  <div>
                    <span aria-hidden="true">C</span>
                    <p>
                      <strong>Critic joined the review</strong>
                      <small>{postflightConsultation.note}</small>
                    </p>
                  </div>
                  <button type="button" onClick={() => void onOpenCritic()}>
                    Open Critic
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="execution-waiting">
              The approved instruction is with Claude Code. Hearth is watching only for
              its bounded result—not saving or feeding Maker the terminal transcript.
            </p>
          )}
          <div className="proposal-actions">
            {proposal.executionResult ? (
              <button
                className="small-button"
                type="button"
                onClick={() => {
                  if (postflightConsultation) {
                    void onOpenCritic();
                    return;
                  }
                  void onCriticProposal(proposal.id).catch((reason: unknown) =>
                    onNotify(
                      reason instanceof Error
                        ? reason.message
                        : "Critic could not receive that execution report."
                    )
                  );
                }}
              >
                {postflightConsultation ? "Open Critic" : "Send to Critic"}
              </button>
            ) : null}
            <button
              className="small-button small-button--quiet"
              type="button"
              title={
                proposal.executionResult
                  ? "Put this reviewed report away"
                  : "Stop waiting for a report without stopping Claude Code"
              }
              onClick={() => void closeProposal()}
            >
              {proposal.executionResult ? "Done" : "Stop tracking"}
            </button>
          </div>
        </section>
      ) : null}
      {!managed ? <form className="maker-rail-composer" onSubmit={(event) => void submit(event)}>
        <label htmlFor="workshop-maker-message">Message Maker</label>
        <textarea
          id="workshop-maker-message"
          wrap="soft"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={submitChatOnEnter}
          placeholder="Talk it through or write a bounded instruction…"
          maxLength={8_000}
        />
        <div>
          {busy && stream ? (
            <button
              className="small-button stop-agent-button"
              type="button"
              onClick={() => void onCancel()}
            >
              Stop
            </button>
          ) : (
            <button className="small-button small-button--quiet" disabled={!message.trim() || busy}>
              Talk
            </button>
          )}
        </div>
      </form> : null}
    </aside>
  );
}

function TechnicalActivity({ activity }: { activity: MakerWorkActivity }): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const routineEditReceipt = activity.kind === "edit" && activity.output
    ? /(?:updated|created) successfully/i.test(activity.output) &&
      /(?:file state is current|no need to read|updated successfully|created successfully)/i.test(activity.output)
    : false;
  const visibleInput = activity.kind === "edit" && activity.diffs?.length
    ? null
    : activity.input;
  const visibleOutput = routineEditReceipt ? null : activity.output;
  const hasDetail = Boolean(
    visibleInput || visibleOutput || activity.diffs?.length
  );
  const support =
    activity.kind === "execute" && activity.input
      ? activity.input.replace(/\s+/g, " ").trim()
      : activity.locations.length
        ? activity.locations.slice(0, 3).join(" · ")
        : activity.toolName ?? "";
  const result = ["execute", "search", "fetch"].includes(activity.kind)
    ? activity.output?.split("\n").find((line) => line.trim() && !/^```/.test(line.trim()))?.trim() ?? ""
    : "";
  const normalizedTitle = activity.title.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const supportingText = [support, result]
    .filter((value, index, values) => {
      const normalized = value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
      return Boolean(normalized) && normalized !== normalizedTitle && values.findIndex(
        (candidate) => candidate.replace(/\s+/g, " ").trim().toLocaleLowerCase() === normalized
      ) === index;
    })
    .join(" · ")
    .slice(0, 220);
  const summary = (
    <>
      <span className={`claude-event-glyph is-${activity.kind}`} aria-hidden="true">
        {activity.status === "completed" ? "✓" : activity.status === "failed" ? "×" : activityGlyph(activity.kind)}
      </span>
      <strong title={activity.title}>{activity.title}</strong>
      {supportingText ? <span className="claude-event-location">{supportingText}</span> : null}
      <em>{activity.status.replace("_", " ")}</em>
    </>
  );
  if (!hasDetail) {
    return <article className={`claude-event is-${activity.status}`}>{summary}</article>;
  }
  return (
    <details
      className={`claude-event claude-event--detail is-${activity.status}`}
      open={activity.status === "in_progress" || expanded}
      onToggle={(event) => {
        if (activity.status !== "in_progress") setExpanded(event.currentTarget.open);
      }}
    >
      <summary>{summary}</summary>
      {activity.status === "in_progress" || expanded ? <div className="claude-event-body">
        {visibleInput ? (
          <WorkDetailBlock
            label={activity.kind === "execute" ? "Command / input" : "Input"}
            text={visibleInput}
          />
        ) : null}
        {activity.diffs?.map((diff) => (
          <DiffDetailBlock
            key={diff.path}
            path={diff.path}
            oldText={diff.oldText}
            newText={diff.newText}
          />
        ))}
        {visibleOutput ? <WorkDetailBlock label="Output" text={visibleOutput} /> : null}
      </div> : null}
    </details>
  );
}

function WorkshopTurnTranscript({
  turn,
  nowMs,
  busy,
  interrupted,
  onRetry,
  onResolvePermission
}: {
  turn: WorkshopTurn;
  nowMs: number;
  busy: boolean;
  interrupted: boolean;
  onRetry: (prompt: string) => Promise<boolean>;
  onResolvePermission: (permissionId: string, optionId: string) => Promise<void>;
}): ReactNode {
  const sessionInputTokens = turn.sessionState?.inputTokens == null
    ? null
    : turn.sessionState.inputTokens +
      (turn.sessionState.cachedReadTokens ?? 0) +
      (turn.sessionState.cachedWriteTokens ?? 0);
  const sessionTokenTotal =
    sessionInputTokens == null || turn.sessionState?.outputTokens == null
      ? null
      : sessionInputTokens + turn.sessionState.outputTokens;
  const activities = turn.activities.filter((activity) => !activity.subagent);
  const agents = turn.activities.filter((activity) => activity.subagent);
  const runningFor = Math.max(0, nowMs - new Date(turn.startedAt).getTime());
  const liveTokenCount = turn.status === "running"
    ? turn.sessionState?.contextUsed ?? sessionTokenTotal
    : sessionTokenTotal ?? turn.sessionState?.contextUsed ?? null;
  const thinkingLabel = runningFor >= 10_000 ? "still thinking…" : "thinking";
  return (
    <section className={`claude-turn is-${turn.status}`} data-turn-id={turn.id}>
      <header className="claude-turn-prompt">
        <div><strong>You</strong><span>{formatTime(turn.startedAt)}</span></div>
        <p>{turn.prompt}</p>
      </header>

      <div className="claude-maker-line">
        <strong>Maker</strong>
        <span>{turn.status === "running" ? `(${thinkingLabel})` : "Workstream"}</span>
        {turn.status === "running" && liveTokenCount != null ? (
          <small className="claude-live-token">{formatTokenCount(liveTokenCount)} tokens</small>
        ) : null}
      </div>

      {turn.plan.length ? (
        <section className="claude-plan" aria-label="Maker plan">
          <header><strong>Plan</strong><span>{turn.plan.filter((entry) => entry.status === "completed").length}/{turn.plan.length}</span></header>
          <ol>
            {turn.plan.map((entry, index) => (
              <li className={`is-${entry.status}`} key={`${index}-${entry.content}`}>
                <span aria-hidden="true">{entry.status === "completed" ? "✓" : entry.status === "in_progress" ? "●" : "○"}</span>
                <p>{entry.content}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {turn.thoughts ? (
        <details className="claude-thinking" open={turn.status === "running" && !activities.length}>
          <summary><span>Thinking</span><small>{turn.status === "running" ? "live" : "show"}</small></summary>
          <pre>{turn.thoughts}</pre>
        </details>
      ) : null}

      <div className="claude-events">
        {activities.map((activity) => <TechnicalActivity activity={activity} key={activity.id} />)}
      </div>

      {agents.length ? (
        <details className="claude-agents" open>
          <summary><span>Agents</span><small>{agents.length}</small></summary>
          <div>
            {agents.map((agent) => (
              <article key={agent.id}>
                <span aria-hidden="true">⚙</span>
                <strong>{agent.title}</strong>
                <em>{agent.status.replace("_", " ")}</em>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      {turn.permissions.map((permission) => {
        const allow = permission.options.find((option) => option.kind === "allow_once") ??
          permission.options.find((option) => option.kind === "allow_always");
        const reject = permission.options.find((option) => option.kind === "reject_once") ??
          permission.options.find((option) => option.kind === "reject_always");
        return (
          <article className="managed-permission" key={permission.id}>
            <div><p className="eyebrow">Your call</p><h3>{permission.title}</h3><small>Maker paused before this {permission.kind} action.</small></div>
            <div>
              {reject ? <button className="small-button small-button--quiet" type="button" onClick={() => void onResolvePermission(permission.id, reject.id)}>{reject.kind === "reject_once" ? "Not this time" : reject.label}</button> : null}
              {allow ? <button className="small-button" type="button" onClick={() => void onResolvePermission(permission.id, allow.id)}>{allow.kind === "allow_once" ? "Allow once" : allow.label}</button> : null}
            </div>
          </article>
        );
      })}

      <footer className="claude-turn-status">
        {turn.status === "running" ? <span className="managed-running-spinner" aria-hidden="true" /> : <span className={`claude-turn-result is-${turn.status}`} aria-hidden="true">{turn.status === "completed" ? "✓" : turn.status === "cancelled" ? "■" : "×"}</span>}
        <strong>{turn.status === "running" ? thinkingLabel : turn.status === "completed" ? "Complete" : turn.status === "cancelled" ? interrupted ? "Interrupted" : "Stopped" : "Interrupted"}</strong>
        {liveTokenCount != null ? <span>({formatTokenCount(liveTokenCount)} tokens)</span> : null}
        {turn.status === "failed" || turn.status === "cancelled" ? (
          <button type="button" disabled={busy} onClick={() => void onRetry(turn.prompt)}>Run again</button>
        ) : null}
      </footer>
    </section>
  );
}

function ClaudeWorkbench({
  projectName,
  turns,
  requestId,
  activities,
  plan,
  thoughts,
  sessionState,
  permissions,
  messages,
  working,
  busy,
  onTalk,
  onConfigureSession,
  onCancel,
  onResolvePermission,
  initialDraft
}: {
  projectName: string;
  turns: WorkshopTurn[];
  requestId: string | null;
  activities: MakerWorkActivity[];
  plan: MakerWorkPlanEntry[];
  thoughts: string;
  sessionState: MakerSessionState | null;
  permissions: MakerPermissionRequest[];
  messages: ConversationMessage[];
  working: boolean;
  busy: boolean;
  onTalk: (text: string) => Promise<boolean>;
  onConfigureSession: (control: MakerSessionControl) => Promise<boolean>;
  onCancel: () => Promise<void>;
  onResolvePermission: (permissionId: string, optionId: string) => Promise<void>;
  initialDraft: { id: string; text: string } | null;
}): ReactNode {
  const [message, setMessage] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [followLatest, setFollowLatest] = useState(true);
  const [configuring, setConfiguring] = useState<MakerSessionControl["kind"] | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const latestUser = messages.findLast((item) => item.role === "user") ?? null;
  const persistedCurrent = requestId ? turns.find((turn) => turn.id === requestId) : null;
  const liveTurn: WorkshopTurn | null = requestId
    ? {
        id: requestId,
        workspaceProjectId: persistedCurrent?.workspaceProjectId ?? "",
        rootPath: persistedCurrent?.rootPath ?? "",
        prompt: persistedCurrent?.prompt ?? latestUser?.text ?? "",
        activities,
        plan,
        thoughts,
        sessionState,
        permissions,
        status: working ? "running" : persistedCurrent?.status ?? "completed",
        startedAt: persistedCurrent?.startedAt ?? latestUser?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: working ? null : persistedCurrent?.completedAt ?? new Date().toISOString()
      }
    : null;
  const visibleTurns = liveTurn
    ? [...turns.filter((turn) => turn.id !== liveTurn.id), liveTurn]
    : turns;
  const latestTurnState = visibleTurns.at(-1)?.sessionState ?? null;
  const lastContextState = [sessionState, liveTurn?.sessionState, ...visibleTurns.toReversed().map((turn) => turn.sessionState)]
    .find((state) => state?.contextUsed != null || state?.contextSize != null) ?? null;
  const currentSessionState = sessionState ?? liveTurn?.sessionState ?? latestTurnState;
  const effectiveSessionState = currentSessionState
    ? {
        ...currentSessionState,
        contextUsed: currentSessionState.contextUsed ?? lastContextState?.contextUsed ?? null,
        contextSize: currentSessionState.contextSize ?? lastContextState?.contextSize ?? null
      }
    : lastContextState;
  const sessionInputTokens = effectiveSessionState?.inputTokens == null
    ? null
    : effectiveSessionState.inputTokens +
      (effectiveSessionState.cachedReadTokens ?? 0) +
      (effectiveSessionState.cachedWriteTokens ?? 0);
  const contextUsed = effectiveSessionState?.contextUsed ?? sessionInputTokens;
  const contextSize = effectiveSessionState?.contextSize ?? null;
  const contextPercent = contextUsed != null && contextSize
    ? Math.max(0, Math.min(100, Math.round((contextUsed / contextSize) * 100)))
    : null;

  useEffect(() => {
    if (!working) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [working]);

  useEffect(() => {
    if (!initialDraft) return;
    setMessage(initialDraft.text);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [initialDraft]);

  useEffect(() => {
    if (!followLatest || !transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [activities, permissions, plan, thoughts, visibleTurns.length, working, followLatest]);

  function scrollToLatest(): void {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
    setFollowLatest(true);
  }

  async function configure(control: MakerSessionControl): Promise<boolean> {
    setConfiguring(control.kind);
    try {
      return await onConfigureSession(control);
    } finally {
      setConfiguring(null);
    }
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = message.trim();
    if (!value) return;
    setMessage("");
    const controlCommand = value.match(/^\/(manual|plan|auto|mode|effort)(?:\s+([^\s]+))?\s*$/i);
    if (controlCommand && !busy) {
      const command = controlCommand[1]!.toLocaleLowerCase();
      const requestedValue = controlCommand[2];
      const control: MakerSessionControl = command === "effort"
        ? { kind: "effort", value: requestedValue }
        : {
            kind: "mode",
            value: command === "mode" ? requestedValue : command === "manual" ? "default" : command
          };
      const completed = await configure(control);
      if (!completed) setMessage(value);
      requestAnimationFrame(() => composerRef.current?.focus());
      return;
    }
    setFollowLatest(true);
    const completed = await onTalk(value);
    if (!completed) {
      setMessage(value);
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }

  return (
    <section className="managed-workbench claude-workbench" aria-label={`${projectName} Claude Code workstream`}>
      <header className="claude-session-bar">
        <div className="claude-session-identity">
          <strong>Session:</strong>
          <span className="claude-session-name">{projectName.toLocaleLowerCase().replace(/\s+/g, "-")} · {visibleTurns.at(-1)?.id.slice(0, 8) ?? "ready"}</span>
        </div>
        <span
          className={`claude-context-meter${contextUsed == null ? " is-waiting" : ""}`}
          aria-label={contextPercent == null ? "Context usage waiting" : `Context ${contextPercent}%`}
          title={contextUsed != null
            ? contextSize
              ? `${contextUsed.toLocaleString()} of ${contextSize.toLocaleString()} context tokens used`
              : `${contextUsed.toLocaleString()} context tokens used`
            : "Context usage appears as soon as Claude reports it"}
        >
            <span>Context window</span>
            <strong>
              {contextUsed == null
                ? "Waiting for Claude"
                : contextSize
                  ? `${formatTokenCount(contextUsed)} / ${formatTokenCount(contextSize)} · ${contextPercent}%`
                  : `${formatTokenCount(contextUsed)} used`}
            </strong>
            <i style={{ "--context-fill": `${contextPercent ?? 0}%` } as CSSProperties} />
        </span>
        <div className="claude-session-meta">
          <span className="managed-session-chip">Claude Opus 5</span>
          <span className={`managed-session-chip is-mode is-${effectiveSessionState?.modeId ?? "default"}`}>{makerModeLabel(effectiveSessionState)}</span>
          {effectiveSessionState?.effortName ? <span className="managed-session-chip is-effort">{effectiveSessionState.effortName} effort</span> : null}
        </div>
      </header>

      <div
        className="claude-transcript"
        ref={transcriptRef}
        aria-live="polite"
        onScroll={(event) => {
          const target = event.currentTarget;
          setFollowLatest(target.scrollHeight - target.scrollTop - target.clientHeight < 72);
        }}
      >
        {!visibleTurns.length ? <div className="claude-transcript-empty"><span aria-hidden="true">›_</span><strong>Maker’s ready.</strong><p>Give him the work below. The full technical run stays here.</p></div> : null}
        {visibleTurns.map((turn, index) => <WorkshopTurnTranscript turn={turn} nowMs={nowMs} busy={busy} interrupted={turn.status === "cancelled" && index < visibleTurns.length - 1} onRetry={onTalk} onResolvePermission={onResolvePermission} key={turn.id} />)}
      </div>
      {!followLatest ? <button className="claude-jump-latest" type="button" onClick={scrollToLatest}>Jump to latest ↓</button> : null}

      <form className="claude-composer" onSubmit={(event) => void submit(event)}>
        <textarea ref={composerRef} aria-label="Message Maker" rows={1} wrap="soft" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={submitChatOnEnter} placeholder={busy ? "Interrupt Maker with a new direction…" : "Message Maker…"} maxLength={8_000} />
        <div className="claude-composer-controls">
          <button className={`managed-composer-mode is-${effectiveSessionState?.modeId ?? "default"}`} type="button" disabled={busy || configuring !== null} title="Manual → Auto → Planning" onClick={() => void configure({ kind: "mode" })}>{configuring === "mode" ? "Changing…" : `${makerModeLabel(effectiveSessionState)}${effectiveSessionState?.modePending ? " next" : ""}`}</button>
          <label className="managed-composer-effort" title="Choose Claude's effort level">
            <span>Effort</span>
            <select
              aria-label="Effort level"
              disabled={busy || configuring !== null || !effectiveSessionState?.availableEfforts?.length}
              value={effectiveSessionState?.effortId ?? ""}
              onChange={(event) => void configure({ kind: "effort", value: event.currentTarget.value })}
            >
              {!effectiveSessionState?.availableEfforts?.length ? <option value="">Unavailable</option> : null}
              {effectiveSessionState?.availableEfforts?.map((effort) => <option value={effort.id} key={effort.id}>{effort.name}</option>)}
            </select>
          </label>
          {busy && !message.trim() ? <button className="managed-send-button is-stop" type="button" onClick={() => void onCancel()}>Stop</button> : <button className={`managed-send-button${busy ? " is-interrupt" : ""}`} disabled={!message.trim()} aria-label={busy ? "Interrupt and send to Maker" : "Send to Maker"}>→</button>}
        </div>
      </form>
    </section>
  );
}

function ManagedMakerWorkbench({
  projectName,
  rootPath,
  activities,
  plan,
  thoughts,
  sessionState,
  permissions,
  messages,
  stream,
  working,
  busy,
  onTalk,
  onCancel,
  onResolvePermission,
  onOpenTerminal
}: {
  projectName: string;
  rootPath: string;
  activities: MakerWorkActivity[];
  plan: MakerWorkPlanEntry[];
  thoughts: string;
  sessionState: MakerSessionState | null;
  permissions: MakerPermissionRequest[];
  messages: ConversationMessage[];
  stream: { requestId: string; text: string } | null;
  working: boolean;
  busy: boolean;
  onTalk: (text: string) => Promise<boolean>;
  onCancel: () => Promise<void>;
  onResolvePermission: (permissionId: string, optionId: string) => Promise<void>;
  onOpenTerminal: () => void;
}): ReactNode {
  const [message, setMessage] = useState("");
  const activityListRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const sessionInputTokens = sessionState?.inputTokens == null
    ? null
    : sessionState.inputTokens +
      (sessionState.cachedReadTokens ?? 0) +
      (sessionState.cachedWriteTokens ?? 0);
  const sessionTokenTotal =
    sessionInputTokens == null || sessionState?.outputTokens == null
      ? null
      : sessionInputTokens + sessionState.outputTokens;
  const latestUserIndex = messages.findLastIndex((item) => item.role === "user");
  const latestUser = latestUserIndex >= 0 ? messages[latestUserIndex] : null;
  const latestReply = latestUserIndex >= 0
    ? messages.slice(latestUserIndex + 1).find((item) => item.role === "assistant") ?? null
    : null;

  useEffect(() => {
    const list = activityListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [activities, permissions, plan, thoughts, stream?.text, latestReply?.id]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = message.trim();
    if (!value || busy) return;
    setMessage("");
    const completed = await onTalk(value);
    if (!completed) {
      setMessage(value);
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }

  return (
    <section className="managed-workbench" aria-labelledby="managed-workbench-title">
      <div className="managed-workbench-heading">
        <div>
          <p className="eyebrow">Claude Code · {projectName}</p>
          <h2 id="managed-workbench-title">
            {working ? "Working through it." : "Ready when you are."}
          </h2>
          <small>{rootPath}</small>
        </div>
        <div className="managed-session-status">
          <span className="managed-session-chip">Claude Opus 5</span>
          <span className="managed-session-chip is-mode">
            {sessionState?.modeName ?? "Connecting"}
          </span>
          {sessionState?.ultracodeRequested ? (
            <span className="managed-session-chip is-ultracode">Ultracode</span>
          ) : null}
          {sessionState?.contextUsed != null && sessionState.contextSize ? (
            <span
              className="managed-session-chip is-token-count"
              title={`${sessionState.contextUsed.toLocaleString()} of ${sessionState.contextSize.toLocaleString()} context tokens used`}
            >
              {formatTokenCount(sessionState.contextUsed)} / {formatTokenCount(sessionState.contextSize)} tokens
              <small>
                {Math.round((sessionState.contextUsed / sessionState.contextSize) * 100)}% context
              </small>
            </span>
          ) : null}
          {sessionTokenTotal != null && sessionInputTokens != null && sessionState?.outputTokens != null ? (
            <span
              className="managed-session-chip is-token-count"
              title={`${sessionTokenTotal.toLocaleString()} Claude Code session tokens: ${sessionInputTokens.toLocaleString()} input including cache, ${sessionState.outputTokens.toLocaleString()} output`}
            >
              {formatTokenCount(sessionTokenTotal)} tokens
              <small>
                {formatTokenCount(sessionInputTokens)} in · {formatTokenCount(sessionState.outputTokens)} out
              </small>
            </span>
          ) : null}
          <span className={`managed-state${working ? " is-working" : ""}`}>
            <i /> {working ? "Maker working" : "Ready"}
          </span>
        </div>
      </div>

      <div className="managed-activity managed-transcript" ref={activityListRef} aria-live="polite">
        {!activities.length && !permissions.length && !plan.length && !thoughts && !latestUser ? (
          <div className="managed-empty">
            <span aria-hidden="true">&gt;_</span>
            <p className="eyebrow">One prompt, one real working session</p>
            <h3>Build with Maker beside you.</h3>
            <p>
              Ask for the work below. The full process stays here; Maker keeps the human
              version beside it.
            </p>
          </div>
        ) : null}

        {latestUser ? (
          <article className="managed-turn managed-turn--user">
            <div><strong>You</strong><span>{formatTime(latestUser.createdAt)}</span></div>
            <p>{latestUser.text}</p>
          </article>
        ) : null}

        {working ? (
          <div className="managed-thinking-live">
            <span aria-hidden="true" />
            <strong>Maker is thinking</strong>
          </div>
        ) : null}

        {plan.length ? (
          <section className="managed-plan" aria-label="Maker plan">
            <div className="managed-stream-label">
              <span>Plan</span>
              <small>{plan.filter((entry) => entry.status === "completed").length}/{plan.length}</small>
            </div>
            <ol>
              {plan.map((entry, index) => (
                <li className={`is-${entry.status}`} key={`${index}-${entry.content}`}>
                  <span aria-hidden="true">
                    {entry.status === "completed" ? "✓" : entry.status === "in_progress" ? "●" : "○"}
                  </span>
                  <p>{entry.content}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {thoughts ? (
          <details className="managed-thinking">
            <summary><span>Maker’s working notes</span><small>Show</small></summary>
            <pre>{thoughts}</pre>
          </details>
        ) : null}

        {activities.map((activity) => {
          const hasDetail = Boolean(
            activity.input || activity.output || activity.diffs?.length || activity.toolName
          );
          const summary = (
            <>
              <span className={`managed-activity-icon is-${activity.kind}`} aria-hidden="true">
                {activityGlyph(activity.kind)}
              </span>
              <div>
                <span className="managed-activity-titleline">
                  <strong>{activity.title}</strong>
                  {activity.subagent ? <b>Subagent</b> : null}
                </span>
                {activity.locations.length ? (
                  <small>{activity.locations.slice(0, 3).join(" · ")}</small>
                ) : activity.toolName ? <small>{activity.toolName}</small> : null}
              </div>
              <em>{activity.status.replace("_", " ")}</em>
            </>
          );
          return hasDetail ? (
            <details
              className={`managed-activity-card managed-activity-detail is-${activity.status}${activity.subagent ? " is-subagent" : ""}`}
              key={activity.id}
              open={activity.status === "in_progress"}
            >
              <summary>{summary}</summary>
              <div className="managed-activity-body">
                {activity.input ? (
                  <WorkDetailBlock
                    label={activity.kind === "execute" ? "Command / input" : "Input"}
                    text={activity.input}
                  />
                ) : null}
                {activity.diffs?.map((diff) => (
                  <DiffDetailBlock
                    key={diff.path}
                    path={diff.path}
                    oldText={diff.oldText}
                    newText={diff.newText}
                  />
                ))}
                {activity.output ? (
                  <WorkDetailBlock label="Output" text={activity.output} />
                ) : null}
              </div>
            </details>
          ) : (
            <article
              className={`managed-activity-card is-${activity.status}${activity.subagent ? " is-subagent" : ""}`}
              key={activity.id}
            >
              {summary}
            </article>
          );
        })}

        {permissions.map((permission) => {
          const allow =
            permission.options.find((option) => option.kind === "allow_once") ??
            permission.options.find((option) => option.kind === "allow_always");
          const reject =
            permission.options.find((option) => option.kind === "reject_once") ??
            permission.options.find((option) => option.kind === "reject_always");
          return (
            <article className="managed-permission" key={permission.id}>
              <div>
                <p className="eyebrow">Your call</p>
                <h3>{permission.title}</h3>
                <small>Maker paused before this {permission.kind} action.</small>
              </div>
              <div>
                {reject ? (
                  <button
                    className="small-button small-button--quiet"
                    type="button"
                    onClick={() => void onResolvePermission(permission.id, reject.id)}
                  >
                    {reject.kind === "reject_once" ? "Not this time" : reject.label}
                  </button>
                ) : null}
                {allow ? (
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => void onResolvePermission(permission.id, allow.id)}
                  >
                    {allow.kind === "allow_once" ? "Allow once" : allow.label}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}

        {stream?.text ? (
          <article className="managed-turn managed-turn--maker is-streaming">
            <div><strong>Maker</strong><span>writing</span></div>
            <p>{stream.text}<span className="stream-caret" aria-hidden="true" /></p>
          </article>
        ) : latestReply ? (
          <article className="managed-turn managed-turn--maker">
            <div><strong>Maker</strong><span>{formatTime(latestReply.createdAt)}</span></div>
            <p>{latestReply.text}</p>
          </article>
        ) : null}

        {working ? (
          <div className="managed-running-count">
            <span className="managed-running-spinner" aria-hidden="true" />
            <strong>Running…</strong>
            {sessionTokenTotal != null ? <span>({formatTokenCount(sessionTokenTotal)} tokens)</span> : null}
          </div>
        ) : null}
      </div>

      <form className="managed-session-composer" onSubmit={(event) => void submit(event)}>
        <textarea
          ref={composerRef}
          aria-label="Message Maker"
          wrap="soft"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={submitChatOnEnter}
          placeholder="Message Maker…"
          maxLength={8_000}
        />
        <footer>
          <div>
            <span className={`managed-composer-mode is-${sessionState?.modeId ?? "default"}`}>
              {sessionState?.modeName ?? "Manual"}
            </span>
            {sessionState?.ultracodeRequested ? <span className="managed-composer-ultracode">Ultracode</span> : null}
            {sessionState?.contextUsed != null && sessionState.contextSize ? (
              <span>{Math.round((sessionState.contextUsed / sessionState.contextSize) * 100)}% context</span>
            ) : null}
          </div>
          <div>
            <button className="managed-terminal-link" type="button" onClick={onOpenTerminal}>
              Manual terminal
            </button>
            {busy ? (
              <button className="managed-send-button is-stop" type="button" onClick={() => void onCancel()}>
                Stop
              </button>
            ) : (
              <button className="managed-send-button" disabled={!message.trim() || busy} aria-label="Send to Maker">
                ↑
              </button>
            )}
          </div>
        </footer>
      </form>
    </section>
  );
}

export function WorkshopRoom({
  data,
  focusMode,
  onFocusMode,
  shelfCollapsed,
  onShelfCollapsed,
  onTerminalSnapshot,
  onStart,
  onResume,
  onStop,
  onOwner,
  onInstruction,
  onTalk,
  onConfigureSession,
  stream,
  workRequestId,
  workActivities,
  workPlan,
  thoughts,
  sessionState,
  permissions,
  working,
  onResolvePermission,
  onCancelAgent,
  proposal,
  onUpdateProposal,
  onDiscardProposal,
  onCompleteProposal,
  onCloseProposal,
  onCriticProposal,
  onOpenCritic,
  onNotify,
  initialDraft,
  onGather
}: {
  data: BootstrapData;
  focusMode: boolean;
  onFocusMode: (active: boolean) => void;
  shelfCollapsed: boolean;
  onShelfCollapsed: (collapsed: boolean) => void;
  onTerminalSnapshot: (snapshot: TerminalSnapshot) => void;
  onStart: (kind: TerminalKind, owner: TerminalOwner) => Promise<void>;
  onResume: (owner: TerminalOwner) => Promise<void>;
  onStop: (sessionId: string) => Promise<void>;
  onOwner: (sessionId: string, owner: TerminalOwner) => Promise<void>;
  onInstruction: (sessionId: string, proposalId: string, text: string) => Promise<void>;
  onTalk: (text: string) => Promise<boolean>;
  onConfigureSession: (control: MakerSessionControl) => Promise<boolean>;
  stream: { requestId: string; text: string } | null;
  workRequestId: string | null;
  workActivities: MakerWorkActivity[];
  workPlan: MakerWorkPlanEntry[];
  thoughts: string;
  sessionState: MakerSessionState | null;
  permissions: MakerPermissionRequest[];
  working: boolean;
  onResolvePermission: (permissionId: string, optionId: string) => Promise<void>;
  onCancelAgent: () => Promise<void>;
  proposal: MakerProposal | null;
  onUpdateProposal: (proposalId: string, instruction: string) => Promise<void>;
  onDiscardProposal: (proposalId: string) => Promise<void>;
  onCompleteProposal: (proposalId: string) => Promise<void>;
  onCloseProposal: (proposalId: string) => Promise<void>;
  onCriticProposal: (proposalId: string) => Promise<void>;
  onOpenCritic: () => Promise<void>;
  onNotify: (message: string) => void;
  initialDraft: { id: string; text: string } | null;
  onGather: () => void;
}): ReactNode {
  const [busy, setBusy] = useState(false);
  const [makerBusy, setMakerBusy] = useState(false);
  const [terminalFocusRequest, setTerminalFocusRequest] = useState(0);
  const [stopConfirmationOpen, setStopConfirmationOpen] = useState(false);
  const [workbench, setWorkbench] = useState<"maker" | "terminal">(() =>
    proposal?.status === "draft" ||
    proposal?.status === "passed" ||
    (data.terminal.session && LIVE_STATES.has(data.terminal.session.lifecycle))
      ? "terminal"
      : "maker"
  );
  const session = data.terminal.session;
  const isLive = Boolean(session && LIVE_STATES.has(session.lifecycle));
  const sessionProjectMismatch = Boolean(
    session && !sameProjectPath(session.cwd, data.workspace.selectedProject.rootPath)
  );
  const canResume =
    !isLive &&
    session?.kind === "claude" &&
    Boolean(session.claudeSessionId) &&
    session.claudeResumable &&
    data.terminal.capabilities.supportsResume;
  const resumeWasRejected =
    !isLive &&
    session?.kind === "claude" &&
    session.lifecycle === "failed" &&
    !session.claudeSessionId;

  function updateSession(next: TerminalSession | null): void {
    onTerminalSnapshot({
      ...data.terminal,
      session: next
    });
  }

  async function start(kind: TerminalKind): Promise<void> {
    setBusy(true);
    try {
      await onStart(kind, "user");
      setTerminalFocusRequest((request) => request + 1);
    } finally {
      setBusy(false);
    }
  }

  async function resume(): Promise<void> {
    setBusy(true);
    try {
      await onResume("user");
      setTerminalFocusRequest((request) => request + 1);
    } finally {
      setBusy(false);
    }
  }

  async function talk(text: string): Promise<boolean> {
    setMakerBusy(true);
    try {
      return await onTalk(text);
    } finally {
      setMakerBusy(false);
    }
  }

  async function changeOwner(owner: TerminalOwner): Promise<void> {
    if (!session) return;
    await onOwner(session.id, owner);
    if (owner === "user") {
      setTerminalFocusRequest((request) => request + 1);
    }
  }

  return (
    <main className="room-content workshop-room">
      <div className="workshop-heading">
        <div>
          <p className="eyebrow">Workshop · managed work & terminal</p>
          <h1>Work with the process in view.</h1>
        </div>
        <div className="workshop-heading-actions">
          {!focusMode ? (
            <button className="focus-button" type="button" onClick={onGather}>
              Gather in Living Room
            </button>
          ) : null}
          <div className="workbench-switch" aria-label="Workshop surface">
            <button
              className={workbench === "maker" ? "is-active" : ""}
              type="button"
              onClick={() => setWorkbench("maker")}
            >
              Maker session
            </button>
            <button
              className={workbench === "terminal" ? "is-active" : ""}
              type="button"
              onClick={() => {
                setWorkbench("terminal");
                if (session?.owner === "user" && isLive) {
                  setTerminalFocusRequest((request) => request + 1);
                }
              }}
            >
              Terminal
            </button>
          </div>
          <div className={`runtime-pill${workbench === "maker" || isLive ? " runtime-pill--live" : ""}`}>
            <span className={workbench === "maker" || isLive ? "status-dot" : "status-dot status-dot--quiet"} />
            <div>
              <strong>
                {workbench === "maker"
                  ? working
                    ? "Maker is working"
                    : "Managed Maker ready"
                  : isLive
                    ? `${sessionLabel(session)} running`
                    : "Terminal quiet"}
              </strong>
              <small>
                {workbench === "maker"
                  ? "Claude Opus 5 · ACP session"
                  : data.terminal.capabilities.claudeAvailable
                  ? `Claude Code ${data.terminal.capabilities.claudeVersion ?? "available"}`
                  : "Claude Code not detected"}
              </small>
            </div>
          </div>
          {!focusMode && workbench === "terminal" ? (
            <button
              className="focus-button shelf-toggle"
              type="button"
              aria-pressed={shelfCollapsed}
              title={
                shelfCollapsed
                  ? "Restore the session shelf"
                  : "Hide the session shelf while keeping Maker beside the terminal"
              }
              onClick={() => onShelfCollapsed(!shelfCollapsed)}
            >
              {shelfCollapsed ? "Show sessions" : "Hide sessions"}
            </button>
          ) : null}
          {workbench === "terminal" ? (
            <button
              className="focus-button"
              type="button"
              onClick={() => {
                onFocusMode(!focusMode);
                if (session?.owner === "user" && isLive) {
                  setTerminalFocusRequest((request) => request + 1);
                }
              }}
            >
              {focusMode ? "Restore room" : "Focus terminal"}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`workshop-layout${(shelfCollapsed || workbench === "maker") && !focusMode ? " workshop-layout--shelf-collapsed" : ""}`}
      >
        {!focusMode && !shelfCollapsed && workbench === "terminal" ? (
          <aside className="session-shelf">
            <section>
              <p className="eyebrow">Session</p>
              {session ? (
                <button className="session-card is-active" type="button">
                  <span className={`session-kind session-kind--${session.kind}`}>
                    {session.kind === "claude" ? "C" : "›_"}
                  </span>
                  <div>
                    <strong>{sessionLabel(session)}</strong>
                    <small>
                      {session.lifecycle} · {session.owner === "user" ? "your seat" : "Maker seat"}
                      {sessionProjectMismatch ? " · another project" : ""}
                    </small>
                  </div>
                  <i />
                </button>
              ) : (
                <div className="session-empty">
                  <span>›_</span>
                  <p>Your first terminal will live here.</p>
                </div>
              )}
            </section>

            <section className="session-actions">
              <p className="eyebrow">Open</p>
              <button
                type="button"
                onClick={() => void start("powershell")}
                disabled={busy || isLive}
              >
                <span>›_</span>
                <div>
                  <strong>{data.terminal.capabilities.shellName}</strong>
                  <small>In {data.workspace.selectedProject.name}</small>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void start("claude")}
                disabled={busy || isLive || !data.terminal.capabilities.claudeAvailable}
              >
                <span className="claude-glyph">C</span>
                <div>
                  <strong>{resumeWasRejected ? "Start fresh Claude" : "Claude Code"}</strong>
                  <small>
                    {resumeWasRejected
                      ? "Previous conversation was unavailable"
                      : `Named ${data.workspace.selectedProject.name} session`}
                  </small>
                </div>
              </button>
              {canResume ? (
                <button
                  className="resume-session"
                  type="button"
                  onClick={() => void resume()}
                  disabled={busy}
                >
                  <span>↻</span>
                  <div>
                    <strong>Resume Claude</strong>
                    <small>{session.claudeName ?? "Previous session"}</small>
                  </div>
                </button>
              ) : null}
            </section>

            <section className="capability-card">
              <p className="eyebrow">Detected locally</p>
              <div><span>Shell</span><strong>{data.terminal.capabilities.shellName}</strong></div>
              <div><span>Claude</span><strong>{data.terminal.capabilities.claudeAvailable ? "Ready" : "Unavailable"}</strong></div>
              <div><span>Persistence</span><strong>Named + resumable</strong></div>
            </section>
          </aside>
        ) : null}

        {workbench === "maker" ? (
          <ClaudeWorkbench
            projectName={data.workspace.selectedProject.name}
            turns={data.workshop.turns}
            requestId={workRequestId}
            activities={workActivities}
            plan={workPlan}
            thoughts={thoughts}
            sessionState={sessionState}
            permissions={permissions}
            messages={data.conversations.maker}
            working={working && Boolean(workRequestId)}
            busy={makerBusy || working}
            onTalk={talk}
            onConfigureSession={onConfigureSession}
            onCancel={onCancelAgent}
            onResolvePermission={onResolvePermission}
            initialDraft={initialDraft}
          />
        ) : <section className="terminal-workbench">
          <div className="terminal-toolbar">
            <div className="terminal-identity">
              <span className="terminal-lights" aria-hidden="true"><i /><i /><i /></span>
              <div>
                <strong>{sessionLabel(session)}</strong>
                <small className={sessionProjectMismatch ? "is-project-mismatch" : ""}>
                  {session?.cwd ?? data.workspace.selectedProject.rootPath}
                  {sessionProjectMismatch ? ` · Maker context blocked while ${data.workspace.selectedProject.name} is selected` : ""}
                </small>
              </div>
            </div>
            <div className="terminal-controls">
              {session ? (
                <div className="control-switch" aria-label="Terminal control">
                  <button
                    className={session.owner === "user" ? "is-active" : ""}
                    type="button"
                    disabled={!isLive}
                    onClick={() => void changeOwner("user")}
                  >
                    You
                  </button>
                  <button
                    className={session.owner === "maker" ? "is-active" : ""}
                    type="button"
                    disabled={!isLive || session.kind !== "claude"}
                    onClick={() => void changeOwner("maker")}
                  >
                    Maker
                  </button>
                </div>
              ) : null}
              {session && isLive ? (
                <button
                  className="stop-session"
                  type="button"
                  onClick={() => setStopConfirmationOpen(true)}
                >
                  Stop
                </button>
              ) : null}
            </div>
            {stopConfirmationOpen && session ? (
              <div className="terminal-stop-confirmation" role="dialog" aria-label={`Stop ${sessionLabel(session)}`}>
                <div>
                  <strong>Stop {sessionLabel(session)}?</strong>
                  <span>This ends its known process tree. Claude stays resumable when the session supports it.</span>
                </div>
                <button type="button" onClick={() => setStopConfirmationOpen(false)}>Keep running</button>
                <button
                  className="is-danger"
                  type="button"
                  onClick={() => {
                    setStopConfirmationOpen(false);
                    void onStop(session.id);
                  }}
                >
                  Stop session
                </button>
              </div>
            ) : null}
          </div>

          {session ? (
            <TerminalViewport
              session={session}
              focusRequest={terminalFocusRequest}
              onSession={updateSession}
              onError={onNotify}
            />
          ) : (
            <div className="terminal-welcome">
              <div className="terminal-welcome-mark">›_</div>
              <p className="eyebrow">A real Windows terminal</p>
              <h2>Start with the shell—or go straight into Claude Code.</h2>
              <p>
                The process lives in Hearth’s local core. You can visit Study, return
                Home, or reload this room without ending it.
              </p>
              <div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void start("claude")}
                  disabled={busy || !data.terminal.capabilities.claudeAvailable}
                >
                  Start Claude Code
                </button>
                <button
                  className="small-button small-button--quiet"
                  type="button"
                  onClick={() => void start("powershell")}
                  disabled={busy}
                >
                  Open {data.terminal.capabilities.shellName}
                </button>
              </div>
            </div>
          )}

          <footer className="terminal-footer">
            <span>
              {session
                ? `${session.cols} × ${session.rows} · PID ${session.pid ?? "stopped"}`
                : "ConPTY ready"}
            </span>
            <span>Ctrl+Shift+C/V · Ctrl+click links · output is not saved to memory</span>
          </footer>
        </section>}

        {!focusMode ? (
          <MakerRail
            messages={data.conversations.maker}
            session={session}
            observation={data.terminal.observation}
            providerLabel={
              data.runtime.provider.residents?.maker.model ??
              (data.runtime.provider.active === "claude-code"
                ? data.runtime.provider.models.maker ?? "Claude Opus 5"
                : "Local")
            }
            providerOnline={
              data.runtime.provider.residents
                ? data.runtime.provider.residents.maker.state === "ready"
                : data.runtime.provider.active === "claude-code" &&
                  data.runtime.provider.state === "ready"
            }
            stream={stream}
            proposal={proposal}
            onUpdateProposal={onUpdateProposal}
            onDiscardProposal={onDiscardProposal}
            onCompleteProposal={onCompleteProposal}
            onCloseProposal={onCloseProposal}
            onCriticProposal={onCriticProposal}
            onOpenCritic={onOpenCritic}
            busy={makerBusy || working}
            managed={workbench === "maker"}
            managedStatus={
              workActivities.findLast((activity) => activity.status === "in_progress")?.title ??
              workActivities.at(-1)?.title ??
              "Working through it."
            }
            onTalk={talk}
            onCancel={onCancelAgent}
            onInstruction={async (text) => {
              if (!session) {
                return;
              }
              if (!proposal) {
                return;
              }
              await onInstruction(session.id, proposal.id, text);
              onNotify("Instruction passed into Claude Code.");
            }}
            onNotify={onNotify}
          />
        ) : null}
      </div>
    </main>
  );
}
