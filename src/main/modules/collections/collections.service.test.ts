import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createCollection,
  createRun,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";

let db: DatabaseInstance;
let cleanup: () => void;

const TEST_USER_DATA = path.join(os.tmpdir(), "mains-collection-sources-test");

vi.mock("electron", () => ({
  app: { getPath: () => TEST_USER_DATA },
}));

vi.mock("../../db/client", () => ({ getDb: () => db }));

import { collectionsService } from "./collections.service";
import { runsRepo } from "../runs/runs.repo";

describe("collectionsService", () => {
  beforeEach(() => {
    ({ db, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
    fs.rmSync(TEST_USER_DATA, { recursive: true, force: true });
  });

  it("creates and lists account-scoped Collections shared by Work and Chat", async () => {
    await collectionsService.create({
      id: "work-a",
      accountId: "default",
      name: "Research",
    });
    await collectionsService.create({
      id: "chat-a",
      accountId: "default",
      name: "Personal",
    });
    createAccount(db, { id: "other" });
    await collectionsService.create({
      id: "other-a",
      accountId: "other",
      name: "Private",
    });

    const shared = await collectionsService.list({ accountId: "default" });

    expect(shared.map((collection) => collection.id).sort()).toEqual([
      "chat-a",
      "work-a",
    ]);
    expect(shared.every((collection) => !("mode" in collection))).toBe(true);
  });

  it("hides archived Collections unless requested", async () => {
    createCollection(db, { id: "archived", isArchived: true });

    await expect(
      collectionsService.list({ accountId: "default" }),
    ).resolves.toEqual([]);
    await expect(
      collectionsService.list({
        accountId: "default",
        includeArchived: true,
      }),
    ).resolves.toHaveLength(1);
  });

  it("removing a Collection detaches and preserves its runs", async () => {
    createCollection(db, { id: "collection-1" });
    createRun(db, {
      id: "run-1",
      mode: "work",
      collectionId: "collection-1",
    });

    await collectionsService.remove("collection-1");

    const run = await runsRepo.findRunById("run-1");
    expect(run?.collectionId).toBeNull();
  });

  it("stores, lists, deduplicates, and removes canonical text Sources", async () => {
    createCollection(db, { id: "collection-1" });

    const first = await collectionsService.addSource({
      accountId: "default",
      collectionId: "collection-1",
      kind: "text",
      name: "Brief",
      text: "A durable piece of context",
    });
    const duplicate = await collectionsService.addSource({
      accountId: "default",
      collectionId: "collection-1",
      kind: "text",
      name: "Duplicate",
      text: "A durable piece of context",
    });

    expect(duplicate.id).toBe(first.id);
    await expect(
      collectionsService.listSources({
        accountId: "default",
        collectionId: "collection-1",
      }),
    ).resolves.toEqual([first]);
    expect(
      fs.readFileSync(
        path.join(
          TEST_USER_DATA,
          "collections",
          "collection-1",
          "sources",
          first.id,
          "content",
        ),
        "utf8",
      ),
    ).toBe("A durable piece of context");

    await collectionsService.removeSource({
      accountId: "default",
      id: first.id,
    });
    expect(
      fs.existsSync(
        path.join(
          TEST_USER_DATA,
          "collections",
          "collection-1",
          "sources",
          first.id,
        ),
      ),
    ).toBe(false);
  });

  it("rejects Source access from another account", async () => {
    createCollection(db, { id: "collection-1", accountId: "default" });
    createAccount(db, { id: "other" });

    await expect(
      collectionsService.listSources({
        accountId: "other",
        collectionId: "collection-1",
      }),
    ).rejects.toThrow("does not belong");
  });

  it("removes the exact managed Collection directory with the Collection", async () => {
    createCollection(db, { id: "collection-1" });
    await collectionsService.addSource({
      accountId: "default",
      collectionId: "collection-1",
      kind: "file",
      name: "notes.txt",
      mimeType: "text/plain",
      data: Buffer.from("notes").toString("base64"),
    });

    await collectionsService.remove("collection-1");

    expect(
      fs.existsSync(path.join(TEST_USER_DATA, "collections", "collection-1")),
    ).toBe(false);
  });
});
