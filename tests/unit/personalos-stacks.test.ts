import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PersonalOsStacks } from "../../src/core/personalos-stacks";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("PersonalOS Stacks reader", () => {
  it("reads only active links and preserves collection context without writing", async () => {
    const homeRoot = await mkdtemp(path.join(os.tmpdir(), "hearth-stacks-"));
    cleanup.push(homeRoot);
    const dataDirectory = path.join(homeRoot, "PersonalOS", "data");
    await mkdir(dataDirectory, { recursive: true });
    const databasePath = path.join(dataDirectory, "personalos.db");
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE captures (
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        tags TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE hold_collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE hold_filings (
        capture_id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL
      );
      INSERT INTO hold_collections(id, name)
      VALUES ('design', 'Design Skills'), ('security', 'Security');
      INSERT INTO captures(id, body, kind, status, tags, created_at)
      VALUES
        ('one', 'https://example.com/design A useful design reference', 'link', 'promoted', '[]', 1785402000000),
        ('two', 'https://example.com/security', 'link', 'inbox', '["read"]', 1785402060000),
        ('released', 'https://example.com/released', 'link', 'archived', '[]', 1785402120000),
        ('idea', 'Not a library link', 'idea', 'inbox', '[]', 1785402180000);
      INSERT INTO hold_filings(capture_id, collection_id)
      VALUES ('one', 'design'), ('two', 'security'), ('released', 'design');
    `);
    database.close();

    const preview = await new PersonalOsStacks(homeRoot).inspect(
      (url) =>
        url.includes("/security") ? { libraryCollection: null } : null
    );
    expect(preview.state).toBe("ready");
    expect(preview.availableCount).toBe(2);
    expect(preview.newCount).toBe(1);
    expect(preview.organizationCount).toBe(1);
    expect(preview.collections).toEqual([
      { name: "Design Skills", count: 1 },
      { name: "Security", count: 1 }
    ]);
    expect(preview.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "one",
          title: "A useful design reference",
          domain: "example.com",
          collection: "Design Skills",
          tags: ["personalos", "design-skills"],
          alreadyInLibrary: false
        }),
        expect.objectContaining({
          id: "two",
          collection: "Security",
          tags: ["personalos", "security", "read"],
          alreadyInLibrary: true,
          needsCollection: true
        })
      ])
    );

    const check = new DatabaseSync(databasePath, { readOnly: true });
    expect(
      (check.prepare("SELECT COUNT(*) AS count FROM captures").get() as {
        count: number;
      }).count
    ).toBe(4);
    check.close();
  });

  it("reports a missing source quietly", async () => {
    const homeRoot = await mkdtemp(path.join(os.tmpdir(), "hearth-no-stacks-"));
    cleanup.push(homeRoot);
    const preview = await new PersonalOsStacks(homeRoot).inspect(() => null);
    expect(preview).toMatchObject({
      state: "missing",
      availableCount: 0,
      newCount: 0,
      organizationCount: 0,
      items: []
    });
  });
});
