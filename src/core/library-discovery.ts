import { createHash } from "node:crypto";
import type {
  LibraryDiscoveryFeed,
  LibraryDiscoveryItem,
  LibraryDiscoveryTaste,
  WorkspaceProjectDetail
} from "../shared/contracts";
import type { HearthStore } from "./store";

const CACHE_WINDOW_MS = 4 * 60 * 60 * 1_000;
const SEARCH_TIMEOUT_MS = 7_000;

interface GithubRepository {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  topics?: string[];
  pushed_at: string;
  archived: boolean;
}

interface GithubSearchResponse {
  items?: GithubRepository[];
  message?: string;
}

interface SearchSpec {
  kind: LibraryDiscoveryItem["kind"];
  query: string;
  sort: "stars" | "updated";
  emerging: boolean;
  focus: string;
}

function cutoff(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
  return date.toISOString().slice(0, 10);
}

function githubId(repository: GithubRepository): string {
  return `github-${createHash("sha256")
    .update(repository.html_url.toLocaleLowerCase())
    .digest("hex")
    .slice(0, 24)}`;
}

function projectLanguage(detail: WorkspaceProjectDetail): string | null {
  const useful = detail.languages.find(
    (language) => !["json", "markdown", "css", "html"].includes(language.toLocaleLowerCase())
  );
  if (!useful) return null;
  const labels: Record<string, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    rust: "Rust",
    csharp: "C#",
    cpp: "C++"
  };
  return labels[useful.toLocaleLowerCase()] ?? useful;
}

export function discoveryQueries(detail: WorkspaceProjectDetail): SearchSpec[] {
  const language = projectLanguage(detail);
  const languageFilter = language ? ` language:"${language}"` : "";
  const searchable = `${detail.project.name} ${detail.description ?? ""}`.toLocaleLowerCase();
  const focus =
    [
      "agent",
      "terminal",
      "workflow",
      "electron",
      "desktop",
      "automation",
      "productivity",
      "windows",
      "library"
    ].find((candidate) => searchable.includes(candidate)) ?? "";
  const focusFilter = focus ? ` ${focus} in:name,description` : "";
  return [
    {
      kind: "repo",
      query: `archived:false stars:>250 pushed:>${cutoff(180)}${languageFilter}${focusFilter}`,
      sort: "stars",
      emerging: false,
      focus
    },
    {
      kind: "repo",
      query: `archived:false stars:15..750 pushed:>${cutoff(90)}${languageFilter}${focusFilter}`,
      sort: "updated",
      emerging: true,
      focus
    },
    {
      kind: "skill",
      query: `claude-code skills in:name,description archived:false stars:>5 pushed:>${cutoff(365)}`,
      sort: "stars",
      emerging: false,
      focus: "claude"
    },
    {
      kind: "skill",
      query: `codex skills in:name,description archived:false stars:>5 pushed:>${cutoff(365)}`,
      sort: "updated",
      emerging: true,
      focus: "codex"
    }
  ];
}

function relevanceReason(
  repository: GithubRepository,
  detail: WorkspaceProjectDetail,
  spec: SearchSpec
): string {
  const language = projectLanguage(detail);
  const projectFit =
    language && repository.language?.toLocaleLowerCase() === language.toLocaleLowerCase()
      ? `Matches ${detail.project.name}’s ${language}${spec.focus ? ` ${spec.focus}` : ""} work`
      : spec.kind === "skill"
        ? "A current agent-workflow skill collection"
        : "Active and broadly useful";
  if (spec.emerging) {
    return `${projectFit} · emerging and recently active`;
  }
  return `${projectFit} · established and recently maintained`;
}

function score(item: LibraryDiscoveryItem, detail: WorkspaceProjectDetail): number {
  const language = projectLanguage(detail);
  const languageFit =
    language && item.language?.toLocaleLowerCase() === language.toLocaleLowerCase() ? 4 : 0;
  const recency = Math.max(
    0,
    3 - (Date.now() - new Date(item.pushedAt).getTime()) / (60 * 24 * 60 * 60 * 1_000)
  );
  return languageFit + Math.log10(item.stars + 1) + recency + (item.emerging ? 0.35 : 0);
}

function tasteScore(item: LibraryDiscoveryItem, taste?: LibraryDiscoveryTaste): number {
  if (!taste) return 0;
  const language = item.language?.toLocaleLowerCase() ?? "";
  const topics = item.topics.map((topic) => topic.toLocaleLowerCase());
  const keptTopicMatches = topics.filter((topic) => taste.keptTopics.includes(topic)).length;
  const dismissedTopicMatches = topics.filter((topic) =>
    taste.dismissedTopics.includes(topic)
  ).length;
  const searchable =
    `${item.name} ${item.description ?? ""} ${item.language ?? ""} ${item.topics.join(" ")}`
      .toLocaleLowerCase();
  const savedMatches = taste.savedTerms.filter((term) =>
    searchable.includes(term)
  ).length;
  return (
    (language && taste.keptLanguages.includes(language) ? 0.6 : 0) -
    (language && taste.dismissedLanguages.includes(language) ? 0.35 : 0) +
    Math.min(1.2, keptTopicMatches * 0.3) -
    Math.min(0.8, dismissedTopicMatches * 0.2) +
    Math.min(1.5, savedMatches * 0.3)
  );
}

function personalizedReason(
  item: LibraryDiscoveryItem,
  reason: string,
  taste: LibraryDiscoveryTaste
): string {
  const language = item.language?.toLocaleLowerCase() ?? "";
  const hasKeptLanguage = Boolean(language && taste.keptLanguages.includes(language));
  const hasKeptTopic = item.topics.some((topic) =>
    taste.keptTopics.includes(topic.toLocaleLowerCase())
  );
  if (hasKeptLanguage || hasKeptTopic) {
    return `${reason} · similar to things you’ve kept`;
  }
  const searchable =
    `${item.name} ${item.description ?? ""} ${item.topics.join(" ")}`
      .toLocaleLowerCase();
  const savedTerm = taste.savedTerms.find((term) => searchable.includes(term));
  return savedTerm
    ? `${reason} · fits material you filed around ${savedTerm}`
    : reason;
}

export function isCredibleSkill(repository: GithubRepository): boolean {
  const name = repository.full_name.toLocaleLowerCase();
  const description = repository.description?.toLocaleLowerCase() ?? "";
  const topics = (repository.topics ?? []).map((topic) =>
    topic.toLocaleLowerCase()
  );
  const visible = `${name} ${description} ${topics.join(" ")}`;
  let evidence = 0;
  if (/(?:^|[/_-])skills?(?:$|[/_-])/.test(name)) evidence += 3;
  if (/\bskills?\b/.test(description)) evidence += 2;
  if (
    topics.some((topic) =>
      ["agent-skills", "claude-code-skills", "codex-skills", "skills"].includes(
        topic
      )
    )
  ) {
    evidence += 3;
  }
  if (/\b(?:claude(?:-code)?|codex|agent)\b/.test(visible)) evidence += 2;
  return evidence >= 5;
}

export function isCredibleEmergingRepository(
  repository: GithubRepository
): boolean {
  const topics = repository.topics ?? [];
  const description = repository.description?.trim() ?? "";
  return (
    topics.length > 0 ||
    repository.stargazers_count >= 300 ||
    description.length >= 80
  );
}

export function isEmergingDiscovery(
  repository: Pick<GithubRepository, "stargazers_count">,
  kind: LibraryDiscoveryItem["kind"]
): boolean {
  // Maturity belongs to the project, not the provider named in the query.
  // Skill collections are a smaller ecosystem, so their dependable threshold
  // is intentionally lower than a general repository's.
  return repository.stargazers_count < (kind === "skill" ? 75 : 250);
}

const SPECIALIST_DOMAIN_PATTERN =
  /\b(?:academic|basketball|biomedical|clinical|cricket|drama|football|math|mathematics?|medical|screenwriting|scientific|soccer|sports?)\b/;

export function isRelevantDiscoveryItem(
  item: Pick<
    LibraryDiscoveryItem,
    "name" | "description" | "language" | "topics"
  >,
  taste: LibraryDiscoveryTaste
): boolean {
  const searchable =
    `${item.name} ${item.description ?? ""} ${item.language ?? ""} ${item.topics.join(" ")}`
      .toLocaleLowerCase()
      .replace(/[-_/]+/g, " ");
  if (taste.savedTerms.some((term) => searchable.includes(term))) {
    return true;
  }
  return !SPECIALIST_DOMAIN_PATTERN.test(searchable);
}

export function balancedDiscoveryItems(
  items: LibraryDiscoveryItem[],
  detail: WorkspaceProjectDetail,
  limit = 12,
  taste?: LibraryDiscoveryTaste
): LibraryDiscoveryItem[] {
  const laneSize = Math.floor(limit / 2);
  const ranked = [...items].sort(
    (left, right) =>
      score(right, detail) +
      tasteScore(right, taste) -
      score(left, detail) -
      tasteScore(left, taste)
  );
  const dependable = ranked.filter((item) => !item.emerging).slice(0, laneSize);
  const emerging = ranked.filter((item) => item.emerging).slice(0, laneSize);
  const chosen = [...dependable, ...emerging];
  if (chosen.length < limit) {
    const ids = new Set(chosen.map((item) => item.id));
    chosen.push(...ranked.filter((item) => !ids.has(item.id)).slice(0, limit - chosen.length));
  }
  return chosen;
}

async function searchGithub(spec: SearchSpec): Promise<LibraryDiscoveryItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const endpoint = new URL("https://api.github.com/search/repositories");
    endpoint.searchParams.set("q", spec.query);
    endpoint.searchParams.set("sort", spec.sort);
    endpoint.searchParams.set("order", "desc");
    endpoint.searchParams.set("per_page", "15");
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "Hearth-Library/0.11",
        "x-github-api-version": "2022-11-28",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    });
    const body = (await response.json()) as GithubSearchResponse;
    if (!response.ok) {
      throw new Error(body.message || `GitHub returned ${response.status}.`);
    }
    return (body.items ?? [])
      .filter((repository) => {
        if (repository.archived) return false;
        const visible = `${repository.full_name} ${repository.description ?? ""} ${(repository.topics ?? []).join(" ")}`
          .toLocaleLowerCase();
        if (spec.kind === "skill") {
          return isCredibleSkill(repository);
        }
        return (
          (!spec.focus || visible.includes(spec.focus)) &&
          (!spec.emerging || isCredibleEmergingRepository(repository))
        );
      })
      .map((repository) => ({
        id: githubId(repository),
        kind: spec.kind,
        name: repository.full_name,
        description: repository.description?.trim() || null,
        url: repository.html_url,
        stars: repository.stargazers_count,
        language: repository.language,
        topics: (repository.topics ?? []).slice(0, 8),
        reason: "",
        emerging: isEmergingDiscovery(repository, spec.kind),
        pushedAt: repository.pushed_at,
        feedback: "none"
      }));
  } finally {
    clearTimeout(timeout);
  }
}

export class LibraryDiscovery {
  constructor(private readonly store: HearthStore) {}

  async refresh(
    detail: WorkspaceProjectDetail,
    force = false
  ): Promise<LibraryDiscoveryFeed> {
    const cached = this.store.getLibraryDiscovery();
    const refreshedTime = cached.refreshedAt ? new Date(cached.refreshedAt).getTime() : 0;
    if (
      !force &&
      cached.items.length > 0 &&
      Number.isFinite(refreshedTime) &&
      Date.now() - refreshedTime < CACHE_WINDOW_MS
    ) {
      return cached;
    }

    const specs = discoveryQueries(detail);
    const taste = this.store.getLibraryDiscoveryTaste();
    const results = await Promise.allSettled(specs.map((spec) => searchGithub(spec)));
    const successful = results.flatMap((result, index) => {
      if (result.status !== "fulfilled") return [];
      const spec = specs[index];
      if (!spec) return [];
      return result.value.map((item) => {
        const feedback = this.store.getLibraryDiscoveryFeedback(item.url);
        const reason = relevanceReason(
          {
            id: 0,
            full_name: item.name,
            html_url: item.url,
            description: item.description,
            stargazers_count: item.stars,
            language: item.language,
            topics: item.topics,
            pushed_at: item.pushedAt,
            archived: false
          },
          detail,
          { ...spec, emerging: item.emerging }
        );
        return {
          ...item,
          feedback,
          reason: personalizedReason(item, reason, taste)
        };
      });
    });
    if (!successful.length) {
      return {
        ...cached,
        state: "stale",
        message: cached.items.length
          ? "GitHub could not be reached, so Librarian kept the last good recommendations."
          : "GitHub could not be reached. Nothing stale was invented to fill the shelf."
      };
    }

    const unique = [...new Map(
      successful.map((item) => [item.url.toLocaleLowerCase(), item])
    ).values()];
    const hidden = unique
      .filter((item) => item.feedback === "dismissed")
      .sort((left, right) => score(right, detail) - score(left, detail))
      .slice(0, 16);
    const active = unique.filter(
      (item) =>
        item.feedback !== "dismissed" &&
        !this.store.findLibraryLinkByUrl(item.url) &&
        isRelevantDiscoveryItem(item, taste)
    );
    const repos = balancedDiscoveryItems(
      active.filter((item) => item.kind === "repo"),
      detail,
      12,
      taste
    );
    const skills = balancedDiscoveryItems(
      active.filter((item) => item.kind === "skill"),
      detail,
      12,
      taste
    );
    return this.store.replaceLibraryDiscovery(
      [...repos, ...skills, ...hidden],
      new Date().toISOString()
    );
  }
}
