// ─────────────────────────────────────────────────────────────
// Jinzo MCP Tools — Shared handler logic
//
// Both Claude and Copilot adapters expose the same five jinzo tools.
// This module holds the handler implementations and descriptions;
// each adapter wraps them into its SDK-specific format.
// ─────────────────────────────────────────────────────────────

import { workspaceDiffsRepo } from "../../workspaceDiffs/workspaceDiffs.repo";
import { reviewsRepo } from "../../reviews/reviews.repo";
import { reviewFindingsRepo } from "../../reviewFindings/reviewFindings.repo";
import { workspaceActivityService } from "../../workspaceActivity/workspaceActivity.service";
import { updateRunBaseRef } from "../../runs";
import { gitService } from "../../git/git.service";

/**
 * Context values captured at run start and threaded through every handler.
 */
export interface JinzoToolContext {
  workspaceId: string | null;
  rootPath: string | null;
  runId: string | null;
}

// ─────────────────────────────────────────────────────────────
// Tool descriptions (shared between Claude MCP + Copilot custom tools)
// ─────────────────────────────────────────────────────────────

export const TOOL_DESCRIPTIONS = {
  GetWorkspaceDiff:
    "Read git diffs from workspace_diffs table. Uses the current workspace by default, or provide runId to get the diff for a specific run.",
  SaveReview:
    "Create a new review record. Returns the generated review ID. Workspace and run are automatically set from the current session.",
  SaveFinding:
    "Save a single code review finding. Returns the generated finding ID.",
  SaveFindings:
    "Save multiple code review findings at once. Returns all generated finding IDs.",
  CommitChanges:
    "Stage and commit changes in the workspace git repository. Use commitInstructions if provided for message style guidance.",
} as const;

// ─────────────────────────────────────────────────────────────
// Handler implementations
// ─────────────────────────────────────────────────────────────

export async function handleGetWorkspaceDiff(
  args: { runId?: string },
  ctx: JinzoToolContext,
) {
  if (!ctx.workspaceId && !args.runId) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: No workspace context and no runId provided",
        },
      ],
      isError: true,
    };
  }

  const row = args.runId
    ? await workspaceDiffsRepo.findByRun(args.runId)
    : await workspaceDiffsRepo.findLatestByWorkspace(ctx.workspaceId!);

  if (!row) {
    return { content: [{ type: "text" as const, text: "No diff found" }] };
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }],
  };
}

export async function handleSaveReview(
  args: {
    title: string;
    summary?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  },
  ctx: JinzoToolContext,
) {
  const reviewId = await reviewsRepo.insert({
    workspaceId: ctx.workspaceId ?? undefined,
    title: args.title,
    summary: args.summary,
    status: (args.status as any) ?? "open",
    runId: ctx.runId ?? undefined,
    metadata: args.metadata,
  });

  if (ctx.workspaceId) {
    workspaceActivityService.log({
      workspaceId: ctx.workspaceId,
      type: "review",
      title: args.title,
      summary: args.summary,
      refId: reviewId,
    });
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ reviewId }) }],
  };
}

export async function handleSaveFinding(
  args: {
    reviewId: string;
    severity: string;
    file: string;
    lineStart?: number;
    lineEnd?: number;
    message: string;
    reason: string;
    suggestion?: string;
    metadata?: Record<string, unknown>;
  },
  ctx: JinzoToolContext,
) {
  const findingId = await reviewFindingsRepo.insert({
    reviewId: args.reviewId,
    severity: args.severity as any,
    file: args.file,
    lineStart: args.lineStart,
    lineEnd: args.lineEnd,
    message: args.message,
    reason: args.reason,
    suggestion: args.suggestion,
    metadata: args.metadata,
  });

  if (ctx.workspaceId) {
    workspaceActivityService.log({
      workspaceId: ctx.workspaceId,
      type: "finding",
      title: `Finding in ${args.file}`,
      summary: args.message,
      refId: findingId,
      metadata: {
        severity: args.severity,
        file: args.file,
        reason: args.reason,
        lineStart: args.lineStart,
        lineEnd: args.lineEnd,
        hasSuggestion: !!args.suggestion,
      },
    });
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ findingId }) }],
  };
}

export async function handleSaveFindings(
  args: {
    reviewId: string;
    findings: Array<{
      severity: string;
      file: string;
      lineStart?: number;
      lineEnd?: number;
      message: string;
      reason: string;
      suggestion?: string;
      metadata?: Record<string, unknown>;
    }>;
  },
  ctx: JinzoToolContext,
) {
  const findingIds = await reviewFindingsRepo.insertMany(
    args.findings.map((f) => ({
      reviewId: args.reviewId,
      severity: f.severity as any,
      file: f.file,
      lineStart: f.lineStart,
      lineEnd: f.lineEnd,
      message: f.message,
      reason: f.reason,
      suggestion: f.suggestion,
      metadata: f.metadata,
    })),
  );

  if (ctx.workspaceId) {
    workspaceActivityService.log({
      workspaceId: ctx.workspaceId,
      type: "finding",
      title: `${args.findings.length} finding${args.findings.length === 1 ? "" : "s"} saved`,
      refId: args.reviewId,
      metadata: {
        count: args.findings.length,
        critical: args.findings.filter((f) => f.severity === "critical")
          .length,
        warning: args.findings.filter((f) => f.severity === "warning")
          .length,
        info: args.findings.filter((f) => f.severity === "info").length,
      },
    });
  }

  return {
    content: [
      { type: "text" as const, text: JSON.stringify({ findingIds }) },
    ],
  };
}

export async function handleCommitChanges(
  args: { message: string; files?: string[] },
  ctx: JinzoToolContext,
) {
  if (!ctx.rootPath) {
    return {
      content: [
        { type: "text" as const, text: "Error: No workspace root path" },
      ],
      isError: true,
    };
  }

  try {
    await gitService.stageFiles(ctx.rootPath, args.files);
    const result = await gitService.commit(ctx.rootPath, args.message);

    // Recapture diff from the new HEAD so the Changes tab
    // reflects the post-commit state (clean working tree).
    const headResult = await gitService.getHeadSha(ctx.rootPath);
    const newHead = headResult.success ? headResult.data : null;

    if (ctx.workspaceId && newHead) {
      const [statusResult, untrackedResult] = await Promise.all([
        gitService.getDiffSince(ctx.rootPath, newHead),
        gitService.getUntrackedFiles(ctx.rootPath),
      ]);
      const diffText = statusResult.success
        ? (statusResult.data ?? "")
        : "";
      const untrackedFiles = untrackedResult.success
        ? (untrackedResult.data ?? [])
        : [];

      await workspaceDiffsRepo.deleteByWorkspace(ctx.workspaceId);
      if (untrackedFiles.length > 0 || diffText) {
        await workspaceDiffsRepo.insertDiff({
          id: crypto.randomUUID(),
          workspaceId: ctx.workspaceId,
          runId: ctx.runId ?? undefined,
          baseRef: newHead,
          diffText,
          filesJson: JSON.stringify(untrackedFiles),
          statsJson: JSON.stringify({
            shortstat: "",
            files: untrackedFiles.length,
            newFiles: untrackedFiles.length,
          }),
        });
      }
    }

    if (ctx.runId && newHead) {
      updateRunBaseRef(ctx.runId, newHead);
    }

    if (ctx.workspaceId) {
      workspaceActivityService.log({
        workspaceId: ctx.workspaceId,
        type: "commit",
        title: args.message,
        refId: newHead ?? undefined,
        metadata: { files: args.files?.length },
      });
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result) },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
