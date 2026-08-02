import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  AgentKey,
  LivingRoomEvent,
  LivingRoomMessage,
  LivingRoomMode,
  LivingRoomSnapshot,
  WorkspaceProjectDetail
} from "../shared/contracts";
import {
  AgentProvider,
  AgentProviderCancelledError
} from "./agent-provider";
import type { ProjectManager } from "./projects";
import type { HearthStore } from "./store";

export interface LivingRoomTurn {
  agent: AgentKey;
  stage: string;
  status: string;
}

function uniqueParticipants(participants: AgentKey[]): AgentKey[] {
  return [...new Set(participants)].slice(0, 4);
}

export function livingRoomTurnPlan(
  mode: LivingRoomMode,
  participants: AgentKey[]
): LivingRoomTurn[] {
  const selected = uniqueParticipants(participants);
  if (mode === "conversation") {
    return [
      {
        agent: selected[0] ?? "companion",
        stage: "Answer the user directly as the one resident they called into the conversation.",
        status: "Thinking it through…"
      }
    ];
  }
  if (mode === "roundtable") {
    return selected.map((agent, index) => ({
      agent,
      status: index === 0 ? "Starting us off…" : "Adding another angle…",
      stage:
        index === 0
          ? "Give your distinct read first. Leave room for the others."
          : "Add your distinct perspective after reading the earlier residents. Disagree or build on them naturally; do not repeat them."
    }));
  }
  const plan: LivingRoomTurn[] = [
    {
      agent: "maker",
      stage: "Make the strongest practical case and recommend the move you would actually take.",
      status: "Making the practical case…"
    },
    {
      agent: "critic",
      stage: "Pressure-test Maker's case directly. Identify the most important flaw, missing proof, or bad tradeoff without inventing objections.",
      status: "Looking for the weak spot…"
    }
  ];
  if (selected.includes("librarian")) {
    plan.push({
      agent: "librarian",
      stage: "Bring in relevant saved precedent or current material if the evidence supports it. Otherwise say briefly that the Library does not change the call.",
      status: "Checking what we already know…"
    });
  }
  plan.push({
    agent: "companion",
    stage: "Close the pressure test. State the real disagreement, what seems strongest, and the decision the user actually needs to make. Do not force consensus.",
    status: "Pulling the decision together…"
  });
  return plan.slice(0, 4);
}

function transcript(messages: LivingRoomMessage[]): string {
  return messages
    .slice(-40)
    .map((message) => {
      const speaker =
        message.role === "user"
          ? "User"
          : message.role === "system"
            ? "Hearth"
            : message.agent === "maker"
              ? "Maker"
              : message.agent === "critic"
                ? "Critic"
                : message.agent === "librarian"
                  ? "Librarian"
                  : "Companion";
      return `${speaker}: ${message.text}`;
    })
    .join("\n\n")
    .slice(-24_000);
}

function projectSummary(detail: WorkspaceProjectDetail | null): string | null {
  if (!detail) return null;
  return [
    `Project: ${detail.project.name}`,
    detail.description ? `Description: ${detail.description}` : null,
    detail.languages.length ? `Languages: ${detail.languages.join(", ")}` : null,
    detail.packageManager ? `Package manager: ${detail.packageManager}` : null,
    `Working tree: ${detail.changeCount} changed · ${detail.stagedCount} staged · ${detail.untrackedCount} untracked`,
    detail.latestCommit ? `Latest commit: ${detail.latestCommit}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function localReply(agent: AgentKey, mode: LivingRoomMode, stage: string): string {
  if (agent === "maker") {
    return mode === "challenge"
      ? "My practical read: pick the smallest move that proves the idea, then let the result decide whether it deserves more work. Building the whole thing first is how this gets expensive and annoying."
      : "I’d keep the next move small and concrete. We’ll learn more from one real pass than another hour of circling it.";
  }
  if (agent === "critic") {
    return "The part I’d push on is the proof. If we can’t name what would change our mind, we’re in danger of calling preference evidence.";
  }
  if (agent === "librarian") {
    return "I don’t have enough specific saved material to overturn that read. I’d treat the Library as supporting context here, not the decision-maker.";
  }
  return stage.includes("Close")
    ? "The useful split is pretty clear: the idea may be worth trying, but only if the first step stays cheap and gives us an honest signal. That’s the decision."
    : "I’m with the smaller test. It keeps the door open without turning a maybe into a whole new obligation.";
}

export class LivingRoomCoordinator {
  private active: {
    requestId: string;
    threadId: string;
    agent: AgentKey | null;
    cancelled: boolean;
  } | null = null;
  private readonly neutralDirectory: string;

  constructor(
    private readonly store: HearthStore,
    private readonly projects: ProjectManager,
    private readonly provider: AgentProvider,
    dataDirectory: string,
    private readonly emit: (event: LivingRoomEvent) => void
  ) {
    this.neutralDirectory = path.join(dataDirectory, "living-room-neutral");
    mkdirSync(this.neutralDirectory, { recursive: true });
  }

  async send(
    requestId: string,
    input: {
      threadId: string;
      text: string;
      mode: LivingRoomMode;
      participants: AgentKey[];
      includeProject: boolean;
    }
  ): Promise<{ snapshot: LivingRoomSnapshot; cancelled: boolean }> {
    if (this.active) {
      throw new Error("The household is already in the middle of a Living Room turn.");
    }
    const selectedProject = this.projects.selectedProject();
    const plan = livingRoomTurnPlan(input.mode, input.participants);
    const participants = uniqueParticipants(plan.map((turn) => turn.agent));
    const userMessage = this.store.appendLivingRoomUserMessage(
      input.threadId,
      input.text,
      input.mode,
      participants,
      input.includeProject,
      selectedProject
    );
    this.active = {
      requestId,
      threadId: input.threadId,
      agent: null,
      cancelled: false
    };
    this.emit({
      type: "started",
      requestId,
      threadId: input.threadId,
      mode: input.mode,
      participants,
      userMessage
    });
    let detail: WorkspaceProjectDetail | null = null;
    if (input.includeProject) {
      detail = await this.projects.detail(selectedProject.id).catch(() => null);
    }
    const boundedProject = projectSummary(detail);
    const initialRoom = this.store.getLivingRoom(selectedProject.id);
    const discussion = initialRoom.threads.find((thread) => thread.id === input.threadId);
    if (!discussion) throw new Error("The active Living Room discussion disappeared.");
    const broughtContext = discussion.context
      ? `Brought into the room · ${discussion.context.label}\n${discussion.context.summary}`
      : null;
    const visibleScope = [
      input.includeProject
        ? `Current project · ${selectedProject.name}. This includes only the visible project summary unless the read-only Critic independently inspects the selected project.`
        : "House only. No project or terminal context is present.",
      broughtContext
    ].filter(Boolean).join("\n\n");
    const boundedEvidence = [boundedProject, broughtContext].filter(Boolean).join("\n\n") || null;
    try {
      for (const turn of plan) {
        if (!this.active || this.active.cancelled) break;
        this.active.agent = turn.agent;
        this.emit({
          type: "resident_started",
          requestId,
          threadId: input.threadId,
          agent: turn.agent,
          stage: turn.status
        });
        const room = this.store.getLivingRoom(selectedProject.id);
        const current = room.threads.find((thread) => thread.id === input.threadId);
        if (!current) throw new Error("The active Living Room discussion disappeared.");
        let reply: string | null = null;
        try {
          const reasoning = await this.provider.reason(
            {
              agent: turn.agent,
              text: input.text,
              history: [],
              context: null,
              sourceEvidence: boundedEvidence,
              libraryEvidence:
                turn.agent === "librarian"
                  ? this.store.getLibrarianEvidence(
                      [input.text, discussion.context?.label, discussion.context?.summary]
                        .filter(Boolean)
                        .join(" ")
                        .slice(0, 4_000)
                    )
                  : null,
              houseMemory: this.store.getHouseMemoryEvidence(
                turn.agent,
                selectedProject.id
              ),
              terminalObservation: null,
              terminalEvidence: null,
              executionResult: null,
              workingDirectory: input.includeProject
                ? selectedProject.rootPath
                : this.neutralDirectory,
              sessionNamespace: `living:${input.threadId}:${turn.agent}`,
              sharedRoom: {
                mode: input.mode,
                stage: turn.stage,
                participants,
                transcript: transcript(current.messages),
                projectContext: visibleScope
              }
            },
            (text) =>
              this.emit({
                type: "delta",
                requestId,
                threadId: input.threadId,
                agent: turn.agent,
                text
              })
          );
          reply = reasoning?.reply ?? null;
        } catch (error) {
          if (error instanceof AgentProviderCancelledError) {
            if (this.active) this.active.cancelled = true;
            break;
          }
          const unavailable = this.store.appendLivingRoomSystemMessage(
            input.threadId,
            `${turn.agent === "maker" ? "Maker" : turn.agent === "critic" ? "Critic" : turn.agent === "librarian" ? "Librarian" : "Companion"} couldn't join this turn. The rest of the discussion can continue.`,
            userMessage.round
          );
          this.emit({
            type: "resident_completed",
            requestId,
            threadId: input.threadId,
            message: unavailable
          });
          continue;
        }
        if (!reply && this.provider.snapshot().selection === "local") {
          reply = localReply(turn.agent, input.mode, turn.stage);
        }
        if (!reply) {
          const unavailable = this.store.appendLivingRoomSystemMessage(
            input.threadId,
            `${turn.agent === "maker" ? "Maker" : turn.agent === "critic" ? "Critic" : turn.agent === "librarian" ? "Librarian" : "Companion"} couldn't join this turn. The rest of the discussion can continue.`,
            userMessage.round
          );
          this.emit({
            type: "resident_completed",
            requestId,
            threadId: input.threadId,
            message: unavailable
          });
          continue;
        }
        const message = this.store.appendLivingRoomResidentMessage(
          input.threadId,
          turn.agent,
          reply,
          userMessage.round
        );
        this.emit({
          type: "resident_completed",
          requestId,
          threadId: input.threadId,
          message
        });
      }
      const cancelled = Boolean(this.active?.cancelled);
      const snapshot = this.store.getLivingRoom(selectedProject.id);
      this.emit({
        type: cancelled ? "cancelled" : "completed",
        requestId,
        threadId: input.threadId,
        snapshot
      });
      return { snapshot, cancelled };
    } finally {
      this.active = null;
    }
  }

  cancel(): boolean {
    if (!this.active) return false;
    this.active.cancelled = true;
    return this.active.agent ? this.provider.cancel(this.active.agent) || true : true;
  }
}
