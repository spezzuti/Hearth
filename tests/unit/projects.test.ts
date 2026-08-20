import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectManager } from "../../src/core/projects";
import { HearthStore } from "../../src/core/store";
import type { MakerProposal, TerminalSession } from "../../src/shared/contracts";

const cleanup: string[] = [];
const openStores = new Set<HearthStore>();

async function openTestStore(
  dataDirectory: string,
  projectRoot: string
): Promise<HearthStore> {
  const store = await HearthStore.open(dataDirectory, projectRoot);
  openStores.add(store);
  return store;
}

afterEach(async () => {
  for (const store of openStores) {
    try {
      store.close();
    } catch {
      // A restart test may already have closed this handle deliberately.
    }
  }
  openStores.clear();
  while (cleanup.length > 0) {
    const target = cleanup.pop();
    if (target) {
      await rm(target, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100
      });
    }
  }
});

describe("ProjectManager bounded project review", () => {
  it("keeps an explicit project selection authoritative over stray terminal activity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hearth-project-recency-"));
    cleanup.push(root);
    const dataDirectory = path.join(root, "data");
    const homeRoot = path.join(root, "home");
    const firstRoot = path.join(homeRoot, "AOLRevive");
    const secondRoot = path.join(homeRoot, "PersonalOS");
    for (const projectRoot of [firstRoot, secondRoot]) {
      await mkdir(path.join(projectRoot, ".git"), { recursive: true });
      await writeFile(path.join(projectRoot, ".git", "HEAD"), "ref: refs/heads/main\n");
    }

    const store = await openTestStore(dataDirectory, secondRoot);
    store.saveWorkspaceSelection(secondRoot);
    const terminal: TerminalSession = {
      id: "f32c059a-b89e-4a31-a9fd-82e44719f712",
      projectId: "project-hearth",
      cwd: firstRoot,
      pid: null,
      kind: "claude",
      owner: "user",
      lifecycle: "stopped",
      startedAt: "2100-01-01T11:00:00.000Z",
      lastActivityAt: "2100-01-01T12:00:00.000Z",
      exitedAt: "2100-01-01T12:00:00.000Z",
      exitCode: 0,
      claudeSessionId: "960e9897-db19-4c10-9ebc-49d94d7bc046",
      claudeName: "Hearth Maker · AOLRevive",
      claudeResumable: true,
      cols: 120,
      rows: 32
    };
    store.saveTerminalSession(terminal);
    const database = new DatabaseSync(store.databasePath);
    database.prepare(`
      UPDATE workspace_preferences
      SET updated_at = ?
      WHERE key = 'selected-project-root'
    `).run("2099-01-01T12:00:00.000Z");
    database.close();

    const restored = new ProjectManager(store, homeRoot, firstRoot);
    expect((await restored.list()).selectedProject.rootPath).toBe(await realpath(secondRoot));
    const restoredSelectionAt = store.getWorkspaceSelectionRecord()?.updatedAt;
    await restored.list(true);
    expect(store.getWorkspaceSelectionRecord()?.updatedAt).toBe(restoredSelectionAt);
    store.close();
  });

  it("rejects the packaged install folder and repairs selection to the real repo", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hearth-installed-project-"));
    cleanup.push(root);
    const dataDirectory = path.join(root, "data");
    const homeRoot = path.join(root, "home");
    const hearthRoot = path.join(homeRoot, "Hearth");
    const installRoot = path.join(homeRoot, "AppData", "Local", "Programs", "Hearth");
    await mkdir(path.join(hearthRoot, ".git"), { recursive: true });
    await writeFile(path.join(hearthRoot, ".git", "HEAD"), "ref: refs/heads/main\n");
    await mkdir(installRoot, { recursive: true });
    await writeFile(path.join(installRoot, "Hearth.exe"), "packaged fixture");

    const store = await openTestStore(dataDirectory, installRoot);
    store.saveWorkspaceSelection(installRoot);
    const projects = new ProjectManager(store, homeRoot, installRoot);
    const catalog = await projects.list();
    const canonicalHearthRoot = await realpath(hearthRoot);

    expect(catalog.projects.some((project) => project.rootPath === installRoot)).toBe(false);
    expect(catalog.selectedProject.rootPath).toBe(canonicalHearthRoot);
    expect(store.getWorkspaceSelection()).toBe(canonicalHearthRoot);
    store.close();
  });

  it("discovers agent projects, previews text, reads diffs, and rejects escapes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hearth-projects-"));
    cleanup.push(root);
    const dataDirectory = path.join(root, "data");
    const homeRoot = path.join(root, "home");
    const hearthRoot = path.join(homeRoot, "Hearth");
    const exampleRoot = path.join(homeRoot, "Example Project");
    await mkdir(hearthRoot, { recursive: true });
    await mkdir(path.join(hearthRoot, ".git"), { recursive: true });
    await writeFile(path.join(hearthRoot, ".git", "HEAD"), "ref: refs/heads/main\n");
    await mkdir(path.join(exampleRoot, ".claude"), { recursive: true });
    await mkdir(path.join(exampleRoot, "src"), { recursive: true });
    await writeFile(
      path.join(exampleRoot, "package.json"),
      JSON.stringify({
        name: "example-project",
        description: "A fixture used to prove bounded project review.",
        packageManager: "npm@11"
      })
    );
    await writeFile(
      path.join(exampleRoot, "README.md"),
      "# Example Project\n\nThe app starts in src/index.ts and delegates support work to src/helper.ts.\n"
    );
    await writeFile(
      path.join(exampleRoot, "src", "index.ts"),
      "export const greeting = \"café Ω 漢字 🚀\";\n"
    );
    await writeFile(
      path.join(exampleRoot, "src", "helper.ts"),
      "export const purpose = \"bounded project review\";\n"
    );
    await writeFile(
      path.join(exampleRoot, ".env"),
      "SEARCH_MARKER=bounded project review\n"
    );
    await writeFile(
      path.join(exampleRoot, ".claude", "settings.json"),
      "{\"note\":\"bounded project review\"}\n"
    );
    execFileSync("git", ["init", "-b", "main"], { cwd: exampleRoot, windowsHide: true });
    execFileSync("git", ["config", "user.email", "hearth@example.invalid"], {
      cwd: exampleRoot,
      windowsHide: true
    });
    execFileSync("git", ["config", "user.name", "Hearth Test"], {
      cwd: exampleRoot,
      windowsHide: true
    });
    execFileSync("git", ["add", "."], { cwd: exampleRoot, windowsHide: true });
    execFileSync("git", ["commit", "-m", "Seed fixture"], {
      cwd: exampleRoot,
      windowsHide: true
    });
    await writeFile(
      path.join(exampleRoot, "src", "index.ts"),
      "export const greeting = \"Hearth changed this line\";\n"
    );

    const store = await openTestStore(dataDirectory, hearthRoot);
    const projects = new ProjectManager(store, homeRoot, hearthRoot);
    const catalog = await projects.list();
    const example = catalog.projects.find((project) => project.name === "Example Project");
    expect(example?.signals).toEqual(expect.arrayContaining(["git", "claude"]));

    const selected = await projects.select(example!.id);
    const canonicalExampleRoot = await realpath(exampleRoot);
    expect(selected.rootPath).toBe(canonicalExampleRoot);
    expect(store.getWorkspaceSelection()).toBe(canonicalExampleRoot);

    const detail = await projects.detail(example!.id);
    expect(detail.description).toContain("bounded project review");
    expect(detail.changeCount).toBe(1);
    expect(detail.languages).toContain("typescript");

    const directory = await projects.listDirectory(example!.id, "src");
    expect(directory.entries.map((entry) => entry.name)).toContain("index.ts");
    const preview = await projects.readFile(example!.id, "src/index.ts");
    expect(preview.language).toBe("typescript");
    expect(preview.text).toContain("Hearth changed this line");
    expect(preview.editable).toBe(true);

    const search = await projects.searchFiles(example!.id, "bounded project review");
    expect(search.matches.map((match) => match.path)).toContain("src/helper.ts");
    expect(search.matches.map((match) => match.path)).not.toContain(".env");
    expect(search.matches.map((match) => match.path)).not.toContain(
      ".claude/settings.json"
    );
    expect(search.scannedFiles).toBeGreaterThan(0);
    const evidenceContext = await projects.context(
      "maker",
      example!.id,
      "evidence",
      undefined,
      ["src/index.ts", "src/helper.ts"]
    );
    expect(evidenceContext.paths).toEqual(["src/index.ts", "src/helper.ts"]);
    expect(evidenceContext.summary).toContain("2 deliberately selected files");
    const evidence = await projects.providerEvidence(evidenceContext);
    expect(evidence).toContain("FILE: src/index.ts");
    expect(evidence).toContain("FILE: src/helper.ts");
    expect(evidence).toContain("Hearth changed this line");
    const projectContext = await projects.context(
      "critic",
      example!.id,
      "project"
    );
    expect(projectContext.summary).toContain("Project review");
    expect(projectContext.paths).toEqual(
      expect.arrayContaining(["README.md", "package.json", "src/index.ts"])
    );
    const projectEvidence = await projects.providerEvidence(projectContext);
    expect(projectEvidence).toContain("PROJECT REVIEW PACKET");
    expect(projectEvidence).toContain("PROJECT MAP");
    expect(projectEvidence).toContain("FILE: README.md");
    expect(projectEvidence).toContain("FILE: src/index.ts");
    expect(projectEvidence).toContain("Hearth changed this line");
    expect(projectEvidence).not.toContain("SEARCH_MARKER");
    expect(projectEvidence).not.toContain(".claude/settings.json");
    await expect(
      projects.context(
        "maker",
        example!.id,
        "evidence",
        undefined,
        [".claude/settings.json"]
      )
    ).rejects.toThrow("outside resident evidence");

    const editDraft = await projects.prepareEdit(
      example!.id,
      "src/index.ts",
      preview.text.replace("Hearth changed", "Hearth safely changed")
    );
    expect(editDraft.additions).toBe(1);
    expect(editDraft.deletions).toBe(1);
    expect(editDraft.lines.some((line) => line.kind === "added")).toBe(true);
    const appliedEdit = await projects.applyEdit(editDraft.id);
    expect(appliedEdit.preview.text).toContain("Hearth safely changed");
    expect(await readFile(path.join(exampleRoot, "src", "index.ts"), "utf8")).toContain(
      "Hearth safely changed"
    );
    expect(await projects.listEdits(example!.id)).toMatchObject([
      {
        id: editDraft.id,
        path: "src/index.ts",
        restoredAt: null
      }
    ]);
    const restoredEdit = await projects.restoreEdit(editDraft.id);
    expect(restoredEdit.preview.text).toContain("Hearth changed this line");
    expect(restoredEdit.record.restoredAt).toBeTruthy();

    const proposalSource = await projects.editProposalSource(
      example!.id,
      "src/index.ts"
    );
    expect(proposalSource.text).toContain("Hearth changed this line");
    const makerDraft = await projects.prepareEdit(
      example!.id,
      "src/index.ts",
      proposalSource.text.replace("Hearth changed", "Maker proposed"),
      {
        request: "Replace the greeting.",
        summary: "Use the proposed greeting.",
        rationale: "This is the deliberately requested one-line change."
      }
    );
    expect(makerDraft).toMatchObject({
      origin: "maker",
      critique: null,
      proposal: {
        request: "Replace the greeting."
      }
    });
    const critiqueSource = projects.editCritiqueSource(makerDraft.id);
    expect(critiqueSource.originalText).toContain("Hearth changed");
    expect(critiqueSource.proposedText).toContain("Maker proposed");
    const critiquedDraft = projects.attachEditCritique(makerDraft.id, {
      verdict: "caution",
      summary: "The literal change is bounded, but verify the wording.",
      concerns: ["No behavior test accompanies this wording change."],
      suggestedChecks: ["Read the rendered greeting."]
    });
    expect(critiquedDraft.critique?.verdict).toBe("caution");
    expect(await readFile(path.join(exampleRoot, "src", "index.ts"), "utf8")).toContain(
      "Hearth changed this line"
    );

    const staleDraft = await projects.prepareEdit(
      example!.id,
      "src/index.ts",
      preview.text.replace("Hearth changed", "A stale edit changed")
    );
    await writeFile(
      path.join(exampleRoot, "src", "index.ts"),
      "export const greeting = \"Someone else changed this\";\n"
    );
    await expect(projects.applyEdit(staleDraft.id)).rejects.toThrow(
      "changed after this preview"
    );
    await writeFile(
      path.join(exampleRoot, "src", "index.ts"),
      "export const greeting = \"Hearth changed this line\";\n"
    );

    await writeFile(path.join(exampleRoot, "broken.json"), "{\"open\": true");
    await expect(
      projects.prepareEdit(example!.id, "broken.json", "{\"still\":")
    ).rejects.toThrow("JSON is not valid");
    await expect(
      projects.prepareEdit(example!.id, "src/index.ts", "safe\0binary")
    ).rejects.toThrow("binary null bytes");

    const diff = await projects.diff(example!.id, "src/index.ts");
    expect(diff.text).toContain("-export const greeting");
    expect(diff.text).toContain("+export const greeting");
    const criticContext = await projects.context(
      "critic",
      example!.id,
      "diff",
      "src/index.ts"
    );
    expect(criticContext.summary).toContain("src/index.ts");
    expect(criticContext.summary).toContain("+1 / -1");
    expect(criticContext.concerns).toContain(
      "Code changed without a visible test change in the current working tree."
    );
    expect(await projects.providerEvidence(criticContext)).toContain(
      "+export const greeting"
    );
    const proposal: MakerProposal = {
      id: "proposal-1",
      sourceMessageId: "message-1",
      workspaceProjectId: example!.id,
      rootPath: exampleRoot,
      projectName: example!.name,
      contextKind: "diff",
      contextPath: null,
      instruction: "Change the greeting.",
      rationale: "Fixture",
      expectedFiles: ["src/index.ts"],
      risk: "low",
      riskSummary: "Fixture",
      consultations: [],
      status: "passed",
      executionResult: {
        changedFiles: ["src/index.ts", "src/missing.ts"],
        validation: ["npm test passed"],
        concerns: [],
        decision: "Review it?",
        corroboration: null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      passedAt: new Date().toISOString(),
      resultAt: new Date().toISOString()
    };
    const corroboration = await projects.corroborateExecutionResult(proposal);
    expect(corroboration.status).toBe("partial");
    expect(corroboration.matchedFiles).toEqual(["src/index.ts"]);
    expect(corroboration.missingReportedFiles).toEqual(["src/missing.ts"]);
    proposal.executionResult!.corroboration = corroboration;
    const executionContext = await projects.executionResultContext(proposal);
    expect(executionContext.agent).toBe("critic");
    expect(executionContext.concerns.join(" ")).toContain("src/missing.ts");

    await writeFile(path.join(exampleRoot, ".env"), "HEARTH_SECRET=do-not-send\n");
    const sensitivePreview = await projects.readFile(example!.id, ".env");
    expect(sensitivePreview.editable).toBe(false);
    expect(sensitivePreview.editReason).toContain("Credential-shaped");
    const sensitiveContext = await projects.context("critic", example!.id, "diff");
    expect(sensitiveContext.concerns).toContain(
      "A credential-shaped path appears in the working changes."
    );
    expect(await projects.providerEvidence(sensitiveContext)).toContain(
      "withheld"
    );
    expect(await projects.providerEvidence(sensitiveContext)).not.toContain(
      "do-not-send"
    );
    await expect(projects.readFile(example!.id, "../outside.txt")).rejects.toThrow(
      /outside this project/
    );
    store.close();
  }, 20_000);

  it("creates a bounded Hearth project from a pursued Studio idea", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hearth-idea-project-"));
    cleanup.push(root);
    const dataDirectory = path.join(root, "data");
    const homeRoot = path.join(root, "home");
    const hearthRoot = path.join(homeRoot, "Hearth");
    await mkdir(path.join(hearthRoot, ".git"), { recursive: true });
    await writeFile(path.join(hearthRoot, ".git", "HEAD"), "ref: refs/heads/main\n");

    const store = await openTestStore(dataDirectory, hearthRoot);
    const saved = store.saveCapture(
      "Build a small room where unfinished ideas can breathe.",
      undefined,
      "idea"
    );
    const idea = store.updateCapture(saved.capture.id, {
      ideaState: "pursuing"
    });
    const projects = new ProjectManager(store, homeRoot, hearthRoot);
    const created = await projects.createFromIdea(idea, "Quiet Ideas");

    expect(created.project.rootPath).toBe(await realpath(
      path.join(homeRoot, "Hearth Projects", "Quiet Ideas")
    ));
    expect(created.project.signals).toContain("hearth");
    expect(
      await readFile(path.join(created.project.rootPath, "IDEA.md"), "utf8")
    ).toContain("unfinished ideas can breathe");
    await expect(projects.createFromIdea(idea, "Quiet Ideas")).rejects.toThrow(
      "already exists"
    );
    await expect(projects.createFromIdea(idea, "../Escape")).rejects.toThrow(
      "cannot be used"
    );
    store.close();
  });

  it("keeps bounded edit recovery available after a core restart", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hearth-edit-recovery-"));
    cleanup.push(root);
    const dataDirectory = path.join(root, "data");
    const homeRoot = path.join(root, "home");
    const projectRoot = path.join(homeRoot, "Recovery Project");
    await mkdir(path.join(projectRoot, ".git"), { recursive: true });
    await writeFile(path.join(projectRoot, ".git", "HEAD"), "ref: refs/heads/main\n");
    await writeFile(path.join(projectRoot, "notes.md"), "# Before\n");

    let store = await openTestStore(dataDirectory, projectRoot);
    let projects = new ProjectManager(store, homeRoot, projectRoot);
    const catalog = await projects.list();
    const canonicalProjectRoot = await realpath(projectRoot);
    const project = catalog.projects.find(
      (candidate) => candidate.rootPath === canonicalProjectRoot
    )!;
    const draft = await projects.prepareEdit(
      project.id,
      "notes.md",
      "# After\n"
    );
    await projects.applyEdit(draft.id);
    expect(await readFile(path.join(projectRoot, "notes.md"), "utf8")).toBe(
      "# After\n"
    );
    store.close();

    store = await openTestStore(dataDirectory, projectRoot);
    projects = new ProjectManager(store, homeRoot, projectRoot);
    await projects.list();
    const records = await projects.listEdits(project.id);
    expect(records).toHaveLength(1);
    expect(records[0]).not.toHaveProperty("backupPath");
    await projects.restoreEdit(records[0]!.id);
    expect(await readFile(path.join(projectRoot, "notes.md"), "utf8")).toBe(
      "# Before\n"
    );
    store.close();
  });
});
