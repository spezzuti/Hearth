import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import type { DatabaseSync as DatabaseHandle } from "node:sqlite";
import type {
  PersonalOsStackItem,
  PersonalOsStacksPreview
} from "../shared/contracts";

const MAX_STACK_ITEMS = 500;
const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
// Preserve the node: prefix through the desktop bundler. Electron exposes the
// built-in SQLite module under this exact specifier.
const sqliteSpecifier = ["node", "sqlite"].join(":");
const sqlite = require(sqliteSpecifier) as typeof import("node:sqlite");

interface PersonalOsCaptureRow {
  id: unknown;
  body: unknown;
  tags: unknown;
  created_at: unknown;
  collection_name: unknown;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizedTag(value: string): string | null {
  const tag = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return tag || null;
}

function sourceTags(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .map(normalizedTag)
          .filter((item): item is string => Boolean(item))
      : [];
  } catch {
    return [];
  }
}

function capturedAt(value: unknown): string {
  const milliseconds = Number(value);
  const date = new Date(Number.isFinite(milliseconds) ? milliseconds : Date.now());
  return Number.isNaN(date.valueOf()) ? new Date().toISOString() : date.toISOString();
}

function parseRow(row: PersonalOsCaptureRow): Omit<
  PersonalOsStackItem,
  "alreadyInLibrary" | "needsCollection"
> | null {
  const body = asString(row.body).trim();
  const match = body.match(URL_PATTERN);
  if (!match) return null;
  const candidate = match[0].replace(/[),.;]+$/, "");
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const collection = asString(row.collection_name).trim() || null;
  const title =
    body
      .replace(match[0], " ")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
      .slice(0, 300) || null;
  const tags = [
    "personalos",
    ...(collection ? [normalizedTag(collection)] : []),
    ...sourceTags(row.tags)
  ].filter((item): item is string => Boolean(item));
  return {
    id: asString(row.id).slice(0, 120),
    url: url.toString(),
    title,
    domain: url.hostname.replace(/^www\./i, ""),
    collection,
    tags: [...new Set(tags)].slice(0, 8),
    capturedAt: capturedAt(row.created_at)
  };
}

export class PersonalOsStacks {
  private readonly sourceRoot: string;
  private readonly databasePath: string;

  constructor(homeRoot: string) {
    this.sourceRoot = path.join(homeRoot, "PersonalOS");
    this.databasePath = path.join(this.sourceRoot, "data", "personalos.db");
  }

  async inspect(
    existingLink: (url: string) => { libraryCollection: string | null } | null
  ): Promise<PersonalOsStacksPreview> {
    let database: DatabaseHandle | null = null;
    try {
      const sourceInfo = await lstat(this.databasePath);
      if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
        return this.unreadable("PersonalOS Stacks was found, but its database is not a regular file.");
      }
      const [canonicalRoot, canonicalDatabase] = await Promise.all([
        realpath(this.sourceRoot),
        realpath(this.databasePath)
      ]);
      const relative = path.relative(canonicalRoot, canonicalDatabase);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        return this.unreadable("PersonalOS Stacks could not be opened from its expected home.");
      }
      database = new sqlite.DatabaseSync(canonicalDatabase, {
        readOnly: true,
        timeout: 2_000
      });
      const rows = database
        .prepare(`
          SELECT
            c.id,
            c.body,
            c.tags,
            c.created_at,
            hc.name AS collection_name
          FROM captures c
          LEFT JOIN hold_filings hf ON hf.capture_id = c.id
          LEFT JOIN hold_collections hc ON hc.id = hf.collection_id
          WHERE c.kind = 'link' AND c.status <> 'archived'
          ORDER BY c.created_at DESC
          LIMIT ?
        `)
        .all(MAX_STACK_ITEMS) as unknown as PersonalOsCaptureRow[];
      const items = rows
        .map(parseRow)
        .filter(
          (
            item
          ): item is Omit<
            PersonalOsStackItem,
            "alreadyInLibrary" | "needsCollection"
          > => Boolean(item)
        )
        .map((item) => {
          const existing = existingLink(item.url);
          return {
            ...item,
            alreadyInLibrary: Boolean(existing),
            needsCollection: Boolean(
              existing && item.collection && !existing.libraryCollection
            )
          };
        });
      const counts = new Map<string, number>();
      for (const item of items) {
        if (item.collection) {
          counts.set(item.collection, (counts.get(item.collection) ?? 0) + 1);
        }
      }
      const newCount = items.filter((item) => !item.alreadyInLibrary).length;
      const organizationCount = items.filter(
        (item) => item.needsCollection
      ).length;
      return {
        state: "ready",
        items,
        collections: [...counts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((left, right) => left.name.localeCompare(right.name)),
        availableCount: items.length,
        newCount,
        organizationCount,
        message:
          items.length === 0
            ? "PersonalOS has no active Stacks links to bring over."
            : newCount === 0 && organizationCount === 0
              ? "Hearth already has every active link and collection from PersonalOS Stacks."
              : newCount === 0
                ? `${organizationCount} ${organizationCount === 1 ? "link is" : "links are"} ready to return to their original Stacks collections.`
              : `${newCount} ${newCount === 1 ? "link is" : "links are"} ready to bring into Hearth.`
      };
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (code === "ENOENT") {
        return {
          state: "missing",
          items: [],
          collections: [],
          availableCount: 0,
          newCount: 0,
          organizationCount: 0,
          message: "No PersonalOS Stacks library was found on this PC."
        };
      }
      return this.unreadable(
        "PersonalOS Stacks is present, but Hearth could not read its current library."
      );
    } finally {
      database?.close();
    }
  }

  private unreadable(message: string): PersonalOsStacksPreview {
    return {
      state: "unreadable",
      items: [],
      collections: [],
      availableCount: 0,
      newCount: 0,
      organizationCount: 0,
      message
    };
  }
}
