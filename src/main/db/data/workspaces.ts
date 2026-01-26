import type { InferInsertModel } from "drizzle-orm";
import { workspaces } from "../schema";
import { nanoid } from "nanoid";

// ─────────────────────────────────────────────────────────────
// Default Workspaces Seed Data
// ─────────────────────────────────────────────────────────────

type CreateWorkspacePayload = InferInsertModel<typeof workspaces>;

export const seedWorkspaces: CreateWorkspacePayload[] = [
  // Note: In production, workspaces are typically created dynamically
  // when users open folders/projects. This is for development/testing.
  {
    id: nanoid(),
    accountId: "default", // references the default account
    name: "jinzo",
    rootPath: process.cwd(), // Current working directory
    repoUrl: null,
    defaultBranch: "refactor",
    metadata: JSON.stringify({
      description: "Main development workspace",
      language: "typescript",
      framework: "electron",
    }),
  },
    {
    id: nanoid(),
    accountId: "default", // references the default account
    name: "home",
    rootPath: "/Users/okanbalci/Desktop/home", // Current working directory
    repoUrl: null,
    defaultBranch: "fitness",
    metadata: JSON.stringify({
      description: "Main development workspace",
      language: "typescript",
      framework: "nextjs",
    }),
  }
];
