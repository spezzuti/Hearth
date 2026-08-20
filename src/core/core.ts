import {
  coreRequestSchema,
  type CoreReadyMessage,
  type CoreRequest,
  type CoreResponse,
  type AgentStreamEvent,
  type LivingRoomEvent
} from "../shared/contracts";
import { randomUUID } from "node:crypto";
import { HearthStore } from "./store";
import { TerminalManager } from "./terminal";
import { ProjectManager } from "./projects";
import {
  AgentProvider,
  AgentProviderCancelledError,
  localMakerProposal,
  localProjectEditCritique,
  localProjectEditProposal,
  residentInterruptionReply,
  buildManagedMakerPromptContext
} from "./agent-provider";
import { isCasualSocialTurn } from "./conversation-intent";
import { enrichLink } from "./link-metadata";
import { LibraryDiscovery } from "./library-discovery";
import { criticConsultationDecision } from "./resident-handoff";
import { PersonalOsStacks } from "./personalos-stacks";
import { LivingRoomCoordinator } from "./living-room";

const dataDirectory = process.env.HEARTH_DATA_DIR;
const projectRoot = process.env.HEARTH_PROJECT_ROOT;
const homeRoot = process.env.HEARTH_HOME_ROOT;

if (!dataDirectory || !projectRoot || !homeRoot) {
  throw new Error(
    "Hearth core requires HEARTH_DATA_DIR, HEARTH_PROJECT_ROOT, and HEARTH_HOME_ROOT"
  );
}

if (!process.parentPort) {
  throw new Error("Hearth core must run as an Electron utility process");
}

const port = process.parentPort;
let projectActivationQueue: Promise<void> = Promise.resolve();

function emitAgentEvent(event: AgentStreamEvent): void {
  port.postMessage({
    type: "agent-event",
    event
  });
}

function emitLivingRoomEvent(event: LivingRoomEvent): void {
  port.postMessage({
    type: "living-room-event",
    event
  });
}

const runtimePromise = HearthStore.open(dataDirectory, projectRoot).then((store) => {
  const projects = new ProjectManager(store, homeRoot, projectRoot);
  const provider = new AgentProvider(
    process.env.HEARTH_AGENT_PROVIDER === "local"
      ? "local"
      : store.getAgentProviderPreference()
  );
  const libraryDiscovery = new LibraryDiscovery(store);
  const personalOsStacks = new PersonalOsStacks(homeRoot);
  const livingRoom = new LivingRoomCoordinator(
    store,
    projects,
    provider,
    dataDirectory,
    emitLivingRoomEvent
  );
  let terminal!: TerminalManager;
  terminal = new TerminalManager(store, () => projects.selectedRootPath(), (event) => {
    port.postMessage({
      type: "terminal-event",
      event
    });
    if (
      event.type === "proposal" &&
      event.proposal.executionResult &&
      !event.proposal.executionResult.corroboration
    ) {
      void projects
        .corroborateExecutionResult(event.proposal)
        .then((corroboration) =>
          store.recordExecutionCorroboration(event.proposal.id, corroboration)
        )
        .then(async (proposal) => {
          const consultation = criticConsultationDecision(proposal);
          if (!consultation) {
            terminal.publishProposal(proposal);
            return;
          }
          try {
            const context = await projects.executionResultContext(proposal);
            const criticHandoff = store.setAgentContext(context, "maker");
            const consultedProposal = store.recordCriticConsultation(
              proposal.id,
              consultation
            );
            terminal.publishProposal(consultedProposal, criticHandoff);
          } catch {
            terminal.publishProposal(proposal);
          }
        })
        .catch(() => undefined);
    }
  });
  return {
    store,
    terminal,
    projects,
    provider,
    libraryDiscovery,
    personalOsStacks,
    livingRoom
  };
});

runtimePromise
  .then(({ store }) => {
    const ready: CoreReadyMessage = {
      type: "ready",
      journalMode: store.journalMode
    };
    port.postMessage(ready);
  })
  .catch((error: unknown) => {
    port.postMessage({
      type: "fatal",
      message: error instanceof Error ? error.message : "The Hearth core could not start."
    });
  });

async function dispatch(request: CoreRequest): Promise<unknown> {
  const {
    store,
    terminal,
    projects,
    provider,
    libraryDiscovery,
    personalOsStacks,
    livingRoom
  } = await runtimePromise;
  switch (request.method) {
    case "bootstrap": {
      const workspace = await projects.list();
      const data = store.getBootstrap(
        provider.snapshot(),
        {
          workspaceProjectId: workspace.selectedProject.id,
          rootPath: workspace.selectedProject.rootPath
        }
      );
      const terminalSnapshot = terminal.snapshot();
      return {
        ...data,
        returnPack: {
          ...data.returnPack,
          sessionState: terminal.describeTruth(),
          restartQuestion: terminal.describeRestartQuestion()
        },
        runtime: {
          ...data.runtime,
          liveProcesses: terminal.isLive() ? 1 : 0
        },
        terminal: terminalSnapshot,
        workspace: {
          selectedProject: workspace.selectedProject
        }
      };
    }
    case "setRoute":
      return store.setRoute(request.payload.route);
    case "createLivingRoomDiscussion":
      return store.createLivingRoomDiscussion(
        request.payload.mode,
        request.payload.participants,
        request.payload.includeProject,
        projects.selectedProject(),
        request.payload.context
          ? { ...request.payload.context, sourceId: request.payload.context.sourceId ?? null }
          : undefined
      );
    case "sendLivingRoomMessage":
      return livingRoom.send(request.id, request.payload);
    case "archiveLivingRoomDiscussion":
      return store.archiveLivingRoomDiscussion(
        request.payload.threadId,
        projects.selectedProject().id
      );
    case "restoreLivingRoomDiscussion":
      return store.restoreLivingRoomDiscussion(
        request.payload.threadId,
        projects.selectedProject().id
      );
    case "renameLivingRoomDiscussion":
      return store.renameLivingRoomDiscussion(
        request.payload.threadId,
        request.payload.title,
        projects.selectedProject().id
      );
    case "cancelLivingRoomDiscussion":
      return { cancelled: livingRoom.cancel() };
    case "getNotificationPreferences":
      return store.getNotificationPreferences();
    case "setNotificationPreferences":
      return store.saveNotificationPreferences(request.payload.preferences);
    case "sendAgentMessage":
      if (request.payload.agent === "companion") {
        const casualSocial = isCasualSocialTurn(request.payload.text);
        const home = casualSocial
          ? null
          : store.getBootstrap(provider.snapshot());
        const selectedProject = projects.selectedProject();
        const recentCaptures =
          home?.captures
            .filter((capture) => !capture.archived)
            .slice(0, 5)
            .map(
              (capture) =>
                `- ${capture.kind}: ${(capture.title ?? capture.text).slice(0, 180)}`
            )
            .join("\n") ?? "";
        let reasoning;
        try {
          reasoning = await provider.reason({
            agent: "companion",
            text: request.payload.text,
            history: store.getAgentConversation("companion"),
            context: null,
            sourceEvidence: home
              ? [
                  `Current project: ${selectedProject.name}`,
                  `Objective: ${home.state.objective}`,
                  `Where the user left off: ${home.returnPack.whereYouLeftOff}`,
                  `Recommended next action: ${home.returnPack.recommendedNextAction}`,
                  `Workshop: ${terminal.describeTruth()}`,
                  `Recent captures:\n${recentCaptures || "- None"}`
                ].join("\n")
              : null,
            libraryEvidence: null,
            houseMemory: casualSocial
              ? store.getResidentSocialMemory("companion")
              : store.getHouseMemoryEvidence(
                  "companion",
                  selectedProject.id
                ),
            terminalObservation: null,
            terminalEvidence: null,
            executionResult: null
          });
        } catch (error) {
          if (error instanceof AgentProviderCancelledError) {
            return {
              messages: store.getAgentConversation("companion"),
              provider: provider.snapshot(),
              cancelled: true
            };
          }
          throw error;
        }
        return {
          messages: store.sendAgentMessage(
            "companion",
            request.payload.text,
            terminal.describeTruth(),
            reasoning?.reply ??
              (provider.snapshot().state === "degraded"
                ? residentInterruptionReply("companion")
                : undefined)
          ),
          provider: provider.snapshot(),
          cancelled: false
        };
      } else if (request.payload.agent === "librarian") {
        const casualSocial = isCasualSocialTurn(request.payload.text);
        let reasoning;
        try {
          reasoning = await provider.reason({
            agent: "librarian",
            text: request.payload.text,
            history: store.getAgentConversation("librarian"),
            context: null,
            sourceEvidence: null,
            libraryEvidence: casualSocial
              ? null
              : store.getLibrarianEvidence(
                  request.payload.text,
                  request.payload.libraryCaptureId
                ),
            houseMemory: casualSocial
              ? store.getResidentSocialMemory("librarian")
              : store.getHouseMemoryEvidence(
                  "librarian",
                  projects.selectedProject().id
                ),
            terminalObservation: null,
            terminalEvidence: null,
            executionResult: null
          });
        } catch (error) {
          if (error instanceof AgentProviderCancelledError) {
            return {
              messages: store.getAgentConversation("librarian"),
              provider: provider.snapshot(),
              cancelled: true
            };
          }
          throw error;
        }
        return {
          messages: store.sendAgentMessage(
            "librarian",
            request.payload.text,
            undefined,
            reasoning?.reply ??
              (provider.snapshot().state === "degraded"
                ? residentInterruptionReply("librarian")
                : undefined)
          ),
          provider: provider.snapshot(),
          cancelled: false
        };
      } else {
        const contextAgent = request.payload.agent;
        const casualSocial = isCasualSocialTurn(request.payload.text);
        const selectedProject = projects.selectedProject();
        const selectedRootPath = selectedProject.rootPath;
        const terminalBelongsToProject = terminal.belongsToProject(selectedRootPath);
        const conversationScope = {
          workspaceProjectId: selectedProject.id,
          rootPath: selectedProject.rootPath
        };
        const savedContext = casualSocial ? null : store.getAgentContext(contextAgent);
        const context =
          savedContext &&
          savedContext.rootPath.toLocaleLowerCase() ===
            selectedRootPath.toLocaleLowerCase()
            ? savedContext
            : null;
        let sourceEvidence: string | null = null;
        if (context) {
          try {
            sourceEvidence = await projects.providerEvidence(context);
          } catch {
            sourceEvidence =
              "The selected evidence could not be refreshed from disk. Only the saved handoff summary is available.";
          }
        }
        const providerWasActive =
          provider.snapshot().active === "claude-code";
        const managedWorkshop =
          request.payload.agent === "maker" && request.payload.surface === "workshop";
        const resumeSessionId = managedWorkshop
          ? store.getMakerContinuationSession(selectedRootPath)
          : null;
        const workshopStartedAt = new Date().toISOString();
        let reasoning;
        try {
          const reasoningRequest = {
              agent: request.payload.agent,
              text: request.payload.text,
              history: store.getAgentConversation(
                request.payload.agent,
                conversationScope
              ),
              context,
              sourceEvidence,
              libraryEvidence: null,
              houseMemory: casualSocial
                ? store.getResidentSocialMemory(request.payload.agent)
                : store.getHouseMemoryEvidence(
                    request.payload.agent,
                    context?.workspaceProjectId ??
                      projects.selectedProject().id
                  ),
              terminalObservation:
                request.payload.agent === "maker" && !casualSocial && terminalBelongsToProject
                  ? terminal.snapshot().observation
                  : null,
              terminalEvidence:
                request.payload.agent === "maker" && !casualSocial
                  ? terminal.makerTerminalView(selectedRootPath)
                  : null,
              executionResult:
                request.payload.agent === "maker" && !casualSocial
                  ? store.getActiveMakerProposal()?.executionResult ?? null
                  : null
            };
          let contextManifest;
          if (managedWorkshop) {
            contextManifest = buildManagedMakerPromptContext(
              reasoningRequest,
              Boolean(resumeSessionId)
            ).manifest;
            store.startWorkshopTurn(
              request.id,
              conversationScope,
              request.payload.text,
              contextManifest,
              workshopStartedAt
            );
          }
          if (providerWasActive || managedWorkshop) {
            emitAgentEvent({
              type: "started",
              agent: request.payload.agent,
              requestId: request.id,
              prompt: managedWorkshop ? request.payload.text : undefined,
              startedAt: managedWorkshop ? workshopStartedAt : undefined,
              contextManifest
            });
          }
          const emitDelta = (text: string) => {
              emitAgentEvent({
                type: "delta",
                agent: contextAgent,
                requestId: request.id,
                text
              });
            };
          reasoning =
            request.payload.agent === "maker" &&
            request.payload.surface === "workshop"
              ? await provider.reasonManagedMaker(
                  request.id,
                  selectedRootPath,
                  reasoningRequest,
                  (event) => {
                    if (event.type === "delta") {
                      emitDelta(event.text);
                    } else if (event.type === "reply_boundary") {
                      emitAgentEvent({
                        type: "delta_reset",
                        agent: "maker",
                        requestId: request.id
                      });
                    } else if (event.type === "activity") {
                      store.recordWorkshopActivity(request.id, event.activity);
                      emitAgentEvent({
                        type: "activity",
                        agent: "maker",
                        requestId: request.id,
                        activity: event.activity
                      });
                    } else if (event.type === "permission") {
                      store.saveWorkshopPermission(request.id, event.permission);
                      emitAgentEvent({
                        type: "permission",
                        agent: "maker",
                        requestId: request.id,
                        permission: event.permission
                      });
                    } else if (event.type === "permission_resolved") {
                      store.resolveWorkshopPermission(request.id, event.permissionId);
                      emitAgentEvent({
                        type: "permission_resolved",
                        agent: "maker",
                        requestId: request.id,
                        permissionId: event.permissionId,
                        optionId: event.optionId
                      });
                    } else if (event.type === "thought") {
                      store.appendWorkshopThought(request.id, event.text);
                      emitAgentEvent({
                        type: "thought",
                        agent: "maker",
                        requestId: request.id,
                        text: event.text
                      });
                    } else if (event.type === "plan") {
                      store.saveWorkshopPlan(request.id, event.entries);
                      emitAgentEvent({
                        type: "plan",
                        agent: "maker",
                        requestId: request.id,
                        entries: event.entries
                      });
                    } else if (event.type === "session_state") {
                      store.saveWorkshopSessionState(request.id, event.state);
                      emitAgentEvent({
                        type: "session_state",
                        agent: "maker",
                        requestId: request.id,
                        state: event.state
                      });
                    } else if (event.type === "health") {
                      const health = {
                        ...event.health,
                        lastTerminalActivityAt: terminalBelongsToProject
                          ? terminal.snapshot().session?.lastActivityAt ?? null
                          : null
                      };
                      store.saveWorkshopHealth(request.id, health);
                      emitAgentEvent({
                        type: "health",
                        agent: "maker",
                        requestId: request.id,
                        health
                      });
                    } else if (event.type === "usage") {
                      store.saveWorkshopUsage(request.id, event.usage);
                      emitAgentEvent({
                        type: "usage",
                        agent: "maker",
                        requestId: request.id,
                        usage: event.usage
                      });
                    }
                  },
                  {
                    resumeSessionId,
                    interruptActive: true,
                    onSessionReady: (sessionId) =>
                      store.saveManagedMakerSession(
                        selectedRootPath,
                        sessionId
                      )
                  }
                )
              : await provider.reason(reasoningRequest, emitDelta);
        } catch (error) {
          if (error instanceof AgentProviderCancelledError) {
            if (managedWorkshop) store.finishWorkshopTurn(request.id, "cancelled");
            emitAgentEvent({
              type: "cancelled",
              agent: request.payload.agent,
              requestId: request.id,
              cancelReason: error.reason
            });
            return {
              messages: store.getAgentConversation(
                request.payload.agent,
                conversationScope
              ),
              provider: provider.snapshot(),
              cancelled: true,
              cancelReason: error.reason
            };
          }
          if (managedWorkshop) {
            store.finishWorkshopTurn(request.id, "failed");
            emitAgentEvent({
              type: "failed",
              agent: "maker",
              requestId: request.id
            });
          }
          throw error;
        }
        const messages = store.sendAgentMessage(
            request.payload.agent,
            request.payload.text,
            terminal.describeTruth(),
            reasoning?.reply ??
              (provider.snapshot().state === "degraded"
                ? residentInterruptionReply(request.payload.agent)
                : undefined),
            conversationScope
          );
        if (managedWorkshop) store.finishWorkshopTurn(request.id, "completed");
        if (providerWasActive || managedWorkshop) {
          emitAgentEvent({
            type: "completed",
            agent: request.payload.agent,
            requestId: request.id
          });
        }
        return {
          messages,
          provider: provider.snapshot(),
          cancelled: false,
          cancelReason: null
        };
      }
    case "resolveMakerPermission":
      if (
        !provider.resolveMakerPermission(
          request.payload.permissionId,
          request.payload.optionId
        )
      ) {
        throw new Error("That Maker permission request is no longer waiting.");
      }
      return { resolved: true };
    case "configureMakerSession": {
      const selectedProject = projects.selectedProject();
      const scope = {
        workspaceProjectId: selectedProject.id,
        rootPath: selectedProject.rootPath
      };
      const state = await provider.configureManagedMaker(
        selectedProject.rootPath,
        request.payload.control,
        {
          resumeSessionId: store.getMakerContinuationSession(selectedProject.rootPath),
          onSessionReady: (sessionId) =>
            store.saveManagedMakerSession(selectedProject.rootPath, sessionId)
        }
      );
      store.saveLatestWorkshopSessionState(scope, state);
      return state;
    }
    case "resetMakerSession": {
      const selectedProject = projects.selectedProject();
      provider.resetManagedMaker(selectedProject.rootPath);
      store.clearManagedMakerSession(selectedProject.rootPath);
      return { reset: true as const };
    }
    case "setAgentProvider":
      store.saveAgentProviderPreference(request.payload.selection);
      return provider.setSelection(request.payload.selection);
    case "cancelAgentMessage":
      return {
        cancelled: provider.cancel(request.payload.agent)
      };
    case "createMakerProposal": {
      const message = store.getConversationMessage(request.payload.messageId);
      if (!message || message.agent !== "maker" || message.role !== "assistant") {
        throw new Error("Only a completed Maker reply can become a Workshop proposal.");
      }
      const context = store.getAgentContext("maker");
      const generated = await provider.propose({ message, context });
      let proposal = store.createMakerProposal(
        message,
        generated?.proposal ?? localMakerProposal(message, context)
      );
      let criticHandoff = null;
      const consultation = criticConsultationDecision(proposal);
      if (consultation) {
        try {
          const criticContext = await projects.proposalReviewContext(proposal);
          criticHandoff = store.setAgentContext(criticContext, "maker");
          proposal = store.recordCriticConsultation(proposal.id, consultation);
        } catch {
          // Proposal creation remains useful if its optional consultation cannot be built.
        }
      }
      return {
        proposal,
        provider: provider.snapshot(),
        criticHandoff
      };
    }
    case "updateMakerProposal":
      return store.updateMakerProposal(
        request.payload.proposalId,
        request.payload.instruction
      );
    case "discardMakerProposal":
      store.discardMakerProposal(request.payload.proposalId);
      return { discarded: true };
    case "completeMakerProposal":
      return store.completeMakerProposal(request.payload.proposalId);
    case "closeMakerProposal":
      store.closeMakerProposal(request.payload.proposalId);
      terminal.stopTrackingProposal(request.payload.proposalId);
      return { closed: true };
    case "handoffExecutionResultToCritic": {
      const proposal = store.getMakerProposal(request.payload.proposalId);
      if (!proposal?.executionResult || proposal.status !== "passed") {
        throw new Error("That Claude Code report is no longer available.");
      }
      const context = await projects.executionResultContext(proposal);
      const update = store.setAgentContext(context);
      const consultedProposal = store.recordCriticConsultation(proposal.id, {
        phase: "postflight",
        reason: "user-requested",
        note: "You asked Critic to review Claude Code’s execution report."
      });
      return {
        ...update,
        proposal: consultedProposal
      };
    }
    case "setAgentContext": {
      const context = await projects.context(
        request.payload.agent,
        request.payload.projectId,
        request.payload.kind,
        request.payload.path,
        request.payload.paths
      );
      return store.setAgentContext(context);
    }
    case "saveCapture": {
      const catalog = await projects.list();
      return store.saveCapture(
        request.payload.text,
        undefined,
        request.payload.kind,
        catalog.projects
      );
    }
    case "updateCapture": {
      const catalog =
        request.payload.patch.workspaceProjectId === undefined
          ? null
          : await projects.list();
      return store.updateCapture(
        request.payload.captureId,
        request.payload.patch,
        catalog?.projects
      );
    }
    case "searchCaptures":
      return store.searchCaptures(
        request.payload.query,
        request.payload.kind,
        request.payload.limit
      );
    case "listLibraryCaptures":
      return store.listLibraryCaptures(request.payload);
    case "inspectPersonalOsStacks":
      return personalOsStacks.inspect(
        (url) => store.findLibraryLinkByUrl(url)
      );
    case "importPersonalOsStacks": {
      const preview = await personalOsStacks.inspect(
        (url) => store.findLibraryLinkByUrl(url)
      );
      if (preview.state !== "ready") {
        throw new Error(preview.message);
      }
      const result = store.importPersonalOsStacks(preview.items);
      return {
        ...result,
        preview: await personalOsStacks.inspect(
          (url) => store.findLibraryLinkByUrl(url)
        )
      };
    }
    case "getArchive":
      return store.getArchive();
    case "removeArchiveItem":
      return store.removeArchiveItem(
        request.payload.archiveId,
        request.payload.kind
      );
    case "getIdeaConversation":
      return store.getIdeaConversation(request.payload.captureId);
    case "sendIdeaMessage": {
      const idea = store.getCapture(request.payload.captureId);
      if (!idea || idea.kind !== "idea") {
        throw new Error("That Studio idea is no longer available.");
      }
      if (idea.ideaState !== "pursuing") {
        throw new Error("Pursue the idea before asking Maker to develop it.");
      }
      const project = projects.selectedProject();
      const ideaText = idea.text.replace(/^\s*idea\s*:\s*/i, "").trim();
      const context = {
        id: randomUUID(),
        agent: "maker" as const,
        workspaceProjectId:
          (idea.promotedAt ? idea.workspaceProjectId : null) ?? project.id,
        projectName:
          (idea.promotedAt ? idea.projectName : null) ?? "Studio idea",
        rootPath: project.rootPath,
        kind: "project" as const,
        path: null,
        paths: [],
        summary: `Studio idea · ${idea.title ?? ideaText.slice(0, 160)}`,
        evidence: [
          `State: ${idea.ideaState}`,
          idea.tags.length ? `Tags: ${idea.tags.join(", ")}` : "No tags yet",
          idea.promotedAt
            ? `Already connected to ${idea.projectName ?? "a project"}`
            : idea.projectName
              ? `Captured while ${idea.projectName} was selected; not promoted yet`
              : "Not promoted to a project yet"
        ],
        concerns: [],
        createdAt: new Date().toISOString()
      };
      const providerWasActive = provider.snapshot().active === "claude-code";
      if (providerWasActive) {
        emitAgentEvent({
          type: "started",
          agent: "maker",
          requestId: request.id
        });
      }
      let reasoning;
      try {
        reasoning = await provider.reason(
          {
            agent: "maker",
            text: request.payload.text,
            history: store.getIdeaConversation(idea.id),
            context,
            sourceEvidence: [
              "This is a Studio idea being developed conversationally.",
              "Do not treat it as an approved build request or claim files were changed.",
              "",
              ideaText
            ].join("\n"),
            libraryEvidence: null,
            houseMemory: store.getHouseMemoryEvidence(
              "maker",
              context.workspaceProjectId
            ),
            terminalObservation: null,
            terminalEvidence: null,
            executionResult: null
          },
          (text) => {
            emitAgentEvent({
              type: "delta",
              agent: "maker",
              requestId: request.id,
              text
            });
          }
        );
      } catch (error) {
        if (error instanceof AgentProviderCancelledError) {
          emitAgentEvent({
            type: "cancelled",
            agent: "maker",
            requestId: request.id
          });
          return {
            messages: store.getIdeaConversation(idea.id),
            provider: provider.snapshot(),
            cancelled: true
          };
        }
        throw error;
      }
      const messages = store.sendIdeaMessage(
        idea.id,
        request.payload.text,
        reasoning?.reply ??
          (provider.snapshot().state === "degraded"
            ? residentInterruptionReply("maker")
            : undefined)
      );
      if (providerWasActive) {
        emitAgentEvent({
          type: "completed",
          agent: "maker",
          requestId: request.id
        });
      }
      return {
        messages,
        provider: provider.snapshot(),
        cancelled: false
      };
    }
    case "promoteIdea": {
      const idea = store.getCapture(request.payload.captureId);
      if (!idea || idea.kind !== "idea") {
        throw new Error("That Studio idea is no longer available.");
      }
      if (idea.promotedAt) {
        throw new Error("That idea is already connected to a project.");
      }
      if (request.payload.target.kind === "existing") {
        const project = await projects.requireDiscoveredProject(
          request.payload.target.projectId
        );
        return {
          capture: store.promoteIdea(idea.id, project, "existing"),
          project,
          created: false,
          originFile: null
        };
      }
      const created = await projects.createFromIdea(
        idea,
        request.payload.target.name
      );
      return {
        capture: store.promoteIdea(idea.id, created.project, "created"),
        project: created.project,
        created: true,
        originFile: created.originFile
      };
    }
    case "enrichCapture": {
      const capture = store.getCapture(request.payload.captureId);
      if (!capture || capture.kind !== "link") {
        throw new Error("That Library link is no longer available.");
      }
      try {
        const metadata = await enrichLink(capture.text);
        return store.applyCaptureMetadata(capture.id, metadata);
      } catch (error) {
        if (capture.reference) {
          store.applyCaptureMetadata(capture.id, {
            title: null,
            description: null,
            reference: {
              ...capture.reference,
              metadataState: "failed"
            }
          });
        }
        throw error;
      }
    }
    case "refreshLibraryDiscovery": {
      const selected = projects.selectedProject();
      const detail = await projects.detail(selected.id);
      return libraryDiscovery.refresh(detail, request.payload.force);
    }
    case "setLibraryDiscoveryFeedback":
      return store.setLibraryDiscoveryFeedback(
        request.payload.discoveryId,
        request.payload.feedback
      );
    case "saveHouseMemory":
      return store.saveHouseMemory(request.payload);
    case "updateHouseMemory":
      return store.updateHouseMemory(
        request.payload.memoryId,
        request.payload.patch
      );
    case "forgetHouseMemory":
      return store.forgetHouseMemory(request.payload.memoryId);
    case "updateObjective":
      return store.updateObjective(request.payload.objective);
    case "leaveProject":
      return store.leaveProject(
        request.payload.note,
        terminal.describeTruth(),
        terminal.describeRestartQuestion()
      );
    case "createBackup":
      return store.createBackup(request.payload.reason);
    case "listWorkspaceProjects":
      return projects.list(request.payload.refresh);
    case "selectWorkspaceProject": {
      const selected = await projects.select(request.payload.projectId);
      terminal.selectProject(selected.rootPath);
      return selected;
    }
    case "activateWorkspaceProject": {
      const activation = projectActivationQueue.then(async () => {
        const target = await projects.detail(request.payload.projectId);
        const liveElsewhere =
          terminal.isLive() && !terminal.belongsToProject(target.project.rootPath);
        const parkedProjectRoot = liveElsewhere
          ? terminal.snapshot().session?.cwd ?? null
          : null;
        if (liveElsewhere) {
          const session = terminal.snapshot().session;
          if (session) terminal.stop(session.id);
        }
        const selected = await projects.select(request.payload.projectId);
        const snapshot = terminal.selectProject(selected.rootPath);
        return {
          project: selected,
          terminal: snapshot,
          parkedProjectRoot
        };
      });
      projectActivationQueue = activation.then(
        () => undefined,
        () => undefined
      );
      return activation;
    }
    case "getWorkspaceProject":
      return projects.detail(request.payload.projectId);
    case "listProjectDirectory":
      return projects.listDirectory(request.payload.projectId, request.payload.path);
    case "readProjectFile":
      return projects.readFile(request.payload.projectId, request.payload.path);
    case "searchProjectFiles":
      return projects.searchFiles(
        request.payload.projectId,
        request.payload.query
      );
    case "prepareProjectEdit":
      return projects.prepareEdit(
        request.payload.projectId,
        request.payload.path,
        request.payload.text
      );
    case "proposeProjectEdit": {
      const source = await projects.editProposalSource(
        request.payload.projectId,
        request.payload.path
      );
      const providerRequest = {
        projectName: source.projectName,
        rootPath: source.rootPath,
        path: source.path,
        language: source.language,
        instruction: request.payload.instruction,
        sourceText: source.text
      };
      const generated = await provider.proposeProjectEdit(providerRequest);
      const proposal =
        generated?.proposal ?? localProjectEditProposal(providerRequest);
      if (!proposal) {
        throw new Error(
          "Maker needs Claude Code for an open-ended file draft. Local mode can only handle a literal “replace this with that” request."
        );
      }
      return {
        draft: await projects.prepareEdit(
          source.projectId,
          source.path,
          proposal.text,
          {
            request: request.payload.instruction,
            summary: proposal.summary,
            rationale: proposal.rationale
          }
        ),
        proposedText: proposal.text,
        provider: provider.snapshot()
      };
    }
    case "critiqueProjectEdit": {
      const source = projects.editCritiqueSource(request.payload.editId);
      const generated = await provider.critiqueProjectEdit(source);
      const critique =
        generated?.critique ?? localProjectEditCritique(source);
      return {
        draft: projects.attachEditCritique(request.payload.editId, critique),
        provider: provider.snapshot()
      };
    }
    case "applyProjectEdit":
      return projects.applyEdit(request.payload.editId);
    case "listProjectEdits":
      return projects.listEdits(request.payload.projectId);
    case "restoreProjectEdit":
      return projects.restoreEdit(request.payload.editId);
    case "readProjectDiff":
      return projects.diff(request.payload.projectId, request.payload.path);
    case "attachTerminal":
      return terminal.snapshot();
    case "detachTerminal":
      return { detached: true };
    case "startTerminal":
      return terminal.start(request.payload.kind, request.payload.owner);
    case "resumeTerminal":
      return terminal.resume(request.payload.owner);
    case "terminalInput":
      terminal.input(request.payload.sessionId, request.payload.data);
      return { accepted: true };
    case "terminalInstruction":
      terminal.instruction(
        request.payload.sessionId,
        request.payload.proposalId,
        request.payload.text
      );
      return { accepted: true };
    case "terminalResize":
      return terminal.resize(
        request.payload.sessionId,
        request.payload.cols,
        request.payload.rows
      );
    case "stopTerminal":
      return terminal.stop(request.payload.sessionId);
    case "setTerminalOwner":
      return terminal.setOwner(request.payload.sessionId, request.payload.owner);
    case "shutdown":
      livingRoom.cancel();
      terminal.shutdown();
      provider.shutdown();
      store.close();
      return { stopped: true };
  }
}

port.on("message", async (event) => {
  const parsed = coreRequestSchema.safeParse(event.data);
  if (!parsed.success) {
    const fallbackId =
      typeof event.data === "object" &&
      event.data !== null &&
      "id" in event.data &&
      typeof event.data.id === "string"
        ? event.data.id
        : "invalid";
    const response: CoreResponse = {
      id: fallbackId,
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "The desktop sent an invalid request to the local core."
      }
    };
    port.postMessage(response);
    return;
  }

  try {
    const result = await dispatch(parsed.data);
    const response: CoreResponse = {
      id: parsed.data.id,
      ok: true,
      result
    };
    port.postMessage(response);
    if (parsed.data.method === "shutdown") {
      setTimeout(() => process.exit(0), 20);
    }
  } catch (error) {
    const response: CoreResponse = {
      id: parsed.data.id,
      ok: false,
      error: {
        code: "CORE_FAILURE",
        message: error instanceof Error ? error.message : "The local core could not complete the request."
      }
    };
    port.postMessage(response);
  }
});
