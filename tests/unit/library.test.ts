import { describe, expect, it } from "vitest";
import {
  balancedDiscoveryItems,
  discoveryQueries,
  isCredibleEmergingRepository,
  isCredibleSkill,
  isEmergingDiscovery,
  isRelevantDiscoveryItem
} from "../../src/core/library-discovery";
import { isPublicAddress, parseLinkMetadata } from "../../src/core/link-metadata";
import { recognizeReference, referenceLabel } from "../../src/core/references";
import type { WorkspaceProjectDetail } from "../../src/shared/contracts";

describe("Library link boundaries", () => {
  it("extracts useful title and description without keeping markup", () => {
    expect(
      parseLinkMetadata(`
        <html>
          <head>
            <title>Hearth &amp; Home</title>
            <meta name="description" content="A calm &quot;working&quot; place.">
          </head>
        </html>
      `)
    ).toEqual({
      title: "Hearth & Home",
      description: "A calm \"working\" place."
    });
  });

  it("rejects loopback and private network addresses", () => {
    expect(isPublicAddress("127.0.0.1")).toBe(false);
    expect(isPublicAddress("10.20.30.40")).toBe(false);
    expect(isPublicAddress("192.168.1.5")).toBe(false);
    expect(isPublicAddress("::1")).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("recognizes canonical GitHub entities without fetching them", () => {
    const repository = recognizeReference(
      "http://github.com/OpenAI/Codex.git/?utm_source=feed#readme"
    );
    expect(repository).toMatchObject({
      kind: "repository",
      canonicalUrl: "https://github.com/OpenAI/Codex",
      owner: "OpenAI",
      repository: "Codex",
      metadataState: "unverified"
    });
    expect(referenceLabel(repository!)).toBe("OpenAI/Codex");

    expect(recognizeReference("https://github.com/openai/codex/pull/123?ref_src=test")).toMatchObject({
      kind: "pull-request",
      canonicalUrl: "https://github.com/openai/codex/pull/123",
      identifier: "123"
    });
    expect(recognizeReference("https://github.com/openai/codex/issues/42#discussion")).toMatchObject({
      kind: "issue",
      identifier: "42"
    });
    expect(recognizeReference("https://github.com/openai/codex/releases/tag/v1.2.3")).toMatchObject({
      kind: "release",
      identifier: "v1.2.3"
    });
    expect(recognizeReference("https://github.com/openai/codex/commit/abcdef123456")).toMatchObject({
      kind: "commit",
      identifier: "abcdef123456"
    });
    expect(
      recognizeReference(
        "https://github.com/openai/codex/blob/main/README.md?utm_source=test#usage"
      )
    ).toMatchObject({
      kind: "web",
      canonicalUrl: "https://github.com/openai/codex/blob/main/README.md"
    });
  });

  it("keeps ordinary web references canonical while removing tracking", () => {
    expect(
      recognizeReference("https://Example.com/guide/?b=2&utm_campaign=test&a=1#part")
    ).toMatchObject({
      kind: "web",
      canonicalUrl: "https://example.com/guide?a=1&b=2",
      host: "example.com"
    });
  });
});

describe("Library discovery relevance", () => {
  it("builds current dependable and emerging shelves around the active language", () => {
    const detail: WorkspaceProjectDetail = {
      project: {
        id: "workspace-hearth",
        name: "Hearth",
        rootPath: "C:\\Projects\\Hearth",
        signals: ["git", "claude"],
        branch: "main",
        lastTouchedAt: "2026-07-29T12:00:00.000Z",
        selected: true
      },
      description: null,
      packageManager: "npm",
      languages: ["typescript", "css"],
      changeCount: 0,
      stagedCount: 0,
      untrackedCount: 0,
      latestCommit: null
    };
    const queries = discoveryQueries(detail);
    expect(queries).toHaveLength(4);
    expect(queries.filter((query) => query.kind === "repo")).toHaveLength(2);
    expect(queries.filter((query) => query.kind === "skill")).toHaveLength(2);
    expect(queries[0]?.query).toContain('language:"TypeScript"');
    expect(queries.some((query) => query.emerging)).toBe(true);
  });

  it("keeps dependable and emerging work visible instead of letting star counts take over", () => {
    const detail: WorkspaceProjectDetail = {
      project: {
        id: "workspace-hearth",
        name: "Hearth",
        rootPath: "C:\\Projects\\Hearth",
        signals: ["git"],
        branch: "main",
        lastTouchedAt: "2026-07-29T12:00:00.000Z",
        selected: true
      },
      description: "An agent workflow home.",
      packageManager: "npm",
      languages: ["typescript"],
      changeCount: 0,
      stagedCount: 0,
      untrackedCount: 0,
      latestCommit: null
    };
    const items = Array.from({ length: 16 }, (_, index) => ({
      id: `item-${index}`,
      kind: "repo" as const,
      name: `repo-${index}`,
      description: null,
      url: `https://github.com/example/repo-${index}`,
      stars: index < 8 ? 100_000 - index : 100 - index,
      language: "TypeScript",
      topics: [],
      reason: "Relevant",
      emerging: index >= 8,
      pushedAt: "2026-07-28T12:00:00.000Z",
      feedback: "none" as const
    }));
    const selected = balancedDiscoveryItems(items, detail, 12);
    expect(selected.filter((item) => item.emerging)).toHaveLength(6);
    expect(selected.filter((item) => !item.emerging)).toHaveLength(6);
  });

  it("uses saved Library interests as a modest ranking signal without removing lane balance", () => {
    const detail: WorkspaceProjectDetail = {
      project: {
        id: "workspace-hearth",
        name: "Hearth",
        rootPath: "C:\\Projects\\Hearth",
        signals: ["git"],
        branch: "main",
        lastTouchedAt: "2026-07-29T12:00:00.000Z",
        selected: true
      },
      description: "An agent workflow home.",
      packageManager: "npm",
      languages: ["typescript"],
      changeCount: 0,
      stagedCount: 0,
      untrackedCount: 0,
      latestCommit: null
    };
    const base = {
      kind: "repo" as const,
      description: null,
      stars: 500,
      language: "TypeScript",
      reason: "Relevant",
      emerging: false,
      pushedAt: "2026-07-28T12:00:00.000Z",
      feedback: "none" as const
    };
    const selected = balancedDiscoveryItems(
      [
        {
          ...base,
          id: "generic",
          name: "example/generic",
          url: "https://github.com/example/generic",
          topics: ["utility"]
        },
        {
          ...base,
          id: "agent",
          name: "example/agent",
          url: "https://github.com/example/agent",
          topics: ["agent"]
        }
      ],
      detail,
      2,
      {
        keptLanguages: [],
        dismissedLanguages: [],
        keptTopics: [],
        dismissedTopics: [],
        savedTerms: ["agent"]
      }
    );
    expect(selected[0]?.id).toBe("agent");
  });

  it("requires real skill evidence and basic emerging-project substance", () => {
    const repository = {
      id: 1,
      full_name: "example/claude-code-skills",
      html_url: "https://github.com/example/claude-code-skills",
      description: "A maintained collection of agent skills for Claude Code.",
      stargazers_count: 120,
      language: "TypeScript",
      topics: ["agent-skills", "claude-code"],
      pushed_at: "2026-07-30T12:00:00.000Z",
      archived: false
    };
    expect(isCredibleSkill(repository)).toBe(true);
    expect(
      isCredibleSkill({
        ...repository,
        full_name: "example/cloud-storage",
        description: "Storage integration with a Claude Code plugin.",
        topics: ["storage", "cloud"]
      })
    ).toBe(false);
    expect(
      isCredibleEmergingRepository({
        ...repository,
        stargazers_count: 80,
        description: null,
        topics: []
      })
    ).toBe(false);
    expect(isCredibleEmergingRepository(repository)).toBe(true);
  });

  it("classifies maturity from traction rather than the agent provider", () => {
    expect(isEmergingDiscovery({ stargazers_count: 40 }, "skill")).toBe(true);
    expect(isEmergingDiscovery({ stargazers_count: 400 }, "skill")).toBe(false);
    expect(isEmergingDiscovery({ stargazers_count: 120 }, "repo")).toBe(true);
    expect(isEmergingDiscovery({ stargazers_count: 2_000 }, "repo")).toBe(false);
  });

  it("keeps narrow specialist work out unless the Library shows a real interest in it", () => {
    const item = {
      name: "example/football-agent-skills",
      description: "A skill pack for football analytics.",
      language: "TypeScript",
      topics: ["agent-skills", "sports"]
    };
    const emptyTaste = {
      keptLanguages: [],
      dismissedLanguages: [],
      keptTopics: [],
      dismissedTopics: [],
      savedTerms: []
    };
    expect(isRelevantDiscoveryItem(item, emptyTaste)).toBe(false);
    expect(
      isRelevantDiscoveryItem(item, {
        ...emptyTaste,
        savedTerms: ["football"]
      })
    ).toBe(true);
    expect(
      isRelevantDiscoveryItem(
        {
          ...item,
          name: "example/coding-workflow-skills",
          description: "A practical skill pack for agent coding workflows.",
          topics: ["agent-skills", "developer-tools"]
        },
        emptyTaste
      )
    ).toBe(true);
  });
});
