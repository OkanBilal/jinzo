import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ArchivedWorkspace } from "@/lib/redux/api";
import { ArchivedWorkspaceRow } from "./archived-workspaces";

function archivedWorkspace(
  overrides: Partial<ArchivedWorkspace> = {},
): ArchivedWorkspace {
  return {
    id: "workspace-1",
    accountId: "default",
    projectId: "project-1",
    name: "Archived workspace",
    rootPath: "/tmp/workspace-1",
    repoUrl: null,
    baseBranch: "main",
    metadata: null,
    status: "done",
    isArchived: true,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-02T00:00:00Z"),
    projectName: "Project",
    pathExists: true,
    worktree: null,
    ...overrides,
  };
}

describe("ArchivedWorkspaceRow", () => {
  it("shows a missing Project and disables only Unarchive", () => {
    const markup = renderToStaticMarkup(
      createElement(ArchivedWorkspaceRow, {
        workspace: archivedWorkspace({ projectName: null }),
        onDelete: vi.fn(),
        onUnarchive: vi.fn(),
      }),
    );

    expect(markup).toContain("Project missing");
    expect(markup.match(/ disabled=""/g)).toHaveLength(1);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Unarchive<\/button>/);
  });

  it("keeps Unarchive available when the Project exists", () => {
    const markup = renderToStaticMarkup(
      createElement(ArchivedWorkspaceRow, {
        workspace: archivedWorkspace(),
        onDelete: vi.fn(),
        onUnarchive: vi.fn(),
      }),
    );

    expect(markup).not.toContain("Project missing");
    expect(markup).not.toContain('disabled=""');
  });
});
