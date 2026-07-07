// ─────────────────────────────────────────────────────────────
// Mains MCP Tools — Shared handler logic
//
// Both Claude and Copilot adapters expose the same five mains tools.
// This module holds the handler implementations and descriptions;
// each adapter wraps them into its SDK-specific format.
// ─────────────────────────────────────────────────────────────

import {
  workspaceRepo,
  logWorkspaceActivity,
  emitFindingsChanged,
} from "../../workspace";
import { gitFlowService } from "../../gitFlow";
import type {
  GetWorkspaceDiffArgs,
  SaveReviewArgs,
  SaveFindingArgs,
  SaveFindingsArgs,
  CommitChangesArgs,
  CreatePRArgs,
  CheckPackageArgs,
} from "./mains-tools.schemas";

/**
 * Context values captured at run start and threaded through every handler.
 */
export interface MainsToolContext {
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
    "Stage and commit changes in the workspace git repository. If the project has commitInstructions configured, the tool will return them on the first call (when message is not provided) so you can follow them before committing.",
  CreatePR:
    "Create a GitHub pull request for the current branch using the GitHub CLI (gh). Requires gh to be installed and authenticated. Push the branch before calling this tool. If the project has prInstructions configured, the tool will return them on the first call (when body is not provided) so you can follow them before creating the PR.",
  CheckPackage:
    "IMPORTANT: Call this tool only before explicitly adding named packages (for example: npm install axios, pnpm add zod, pip install requests, cargo add serde). Do NOT call it for dependency restore commands with no package names, such as npm install, npm ci, pnpm install, yarn install, or bun install. Checks packages against a dependency security service and returns safety scores, risk levels, and alerts. If any package is blocked, do NOT install it — inform the user instead.",
} as const;

// ─────────────────────────────────────────────────────────────
// Handler implementations
// ─────────────────────────────────────────────────────────────

export async function handleGetWorkspaceDiff(
  args: GetWorkspaceDiffArgs,
  ctx: MainsToolContext,
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
    ? await workspaceRepo.findDiffByRun(args.runId)
    : await workspaceRepo.findLatestDiffByWorkspace(ctx.workspaceId!);

  if (!row) {
    return { content: [{ type: "text" as const, text: "No diff found" }] };
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }],
  };
}

export async function handleSaveReview(
  args: SaveReviewArgs,
  ctx: MainsToolContext,
) {
  const reviewId = await workspaceRepo.insertReview({
    workspaceId: ctx.workspaceId ?? undefined,
    title: args.title,
    summary: args.summary,
    status: (args.status as any) ?? "open",
    runId: ctx.runId ?? undefined,
    metadata: args.metadata,
  });

  if (ctx.workspaceId) {
    logWorkspaceActivity({
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
  args: SaveFindingArgs,
  ctx: MainsToolContext,
) {
  const findingId = await workspaceRepo.insertFinding({
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
    logWorkspaceActivity({
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
    emitFindingsChanged(ctx.workspaceId);
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ findingId }) }],
  };
}

export async function handleSaveFindings(
  args: SaveFindingsArgs,
  ctx: MainsToolContext,
) {
  const findingIds = await workspaceRepo.insertManyFindings(
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
    logWorkspaceActivity({
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
    emitFindingsChanged(ctx.workspaceId);
  }

  return {
    content: [
      { type: "text" as const, text: JSON.stringify({ findingIds }) },
    ],
  };
}

export async function handleCommitChanges(
  args: CommitChangesArgs,
  ctx: MainsToolContext,
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
    // Instructions-first handshake: on the first call (no message yet) hand the
    // agent the project/app commit instructions so it crafts the message before
    // the real commit. The deterministic shared logic lives in gitFlowService.
    const commitInstructions = ctx.workspaceId
      ? await gitFlowService.getCommitInstructions(ctx.workspaceId)
      : null;

    if (commitInstructions && !args.message) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              commitInstructions,
              hint: "This project has commit instructions. Please follow them to craft the commit message, then call CommitChanges again with the appropriate message.",
            }),
          },
        ],
      };
    }

    if (!args.message) {
      return {
        content: [
          { type: "text" as const, text: "Error: No commit message provided" },
        ],
        isError: true,
      };
    }

    const result = await gitFlowService.performCommit({
      workspaceId: ctx.workspaceId,
      rootPath: ctx.rootPath,
      runId: ctx.runId,
      message: args.message,
      // Match the previous behavior: stage the named files, else everything.
      stage: args.files && args.files.length > 0 ? args.files : "all",
    });

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

export async function handleCreatePR(
  args: CreatePRArgs,
  ctx: MainsToolContext,
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
    // Instructions-first handshake, mirroring CommitChanges. The remote-origin
    // guard + `gh pr create` live in gitFlowService.performCreatePR.
    const prInstructions = ctx.workspaceId
      ? await gitFlowService.getPrInstructions(ctx.workspaceId)
      : null;

    if (prInstructions && !args.body) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              prInstructions,
              hint: "This project has PR instructions. Please follow them to set the title, body, and other parameters, then call CreatePR again with the appropriate values.",
            }),
          },
        ],
      };
    }

    const result = await gitFlowService.performCreatePR({
      workspaceId: ctx.workspaceId,
      rootPath: ctx.rootPath,
      title: args.title,
      body: args.body,
      base: args.base,
      draft: args.draft,
      labels: args.labels,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            url: result.url,
            stdout: result.stdout,
            stderr: result.stderr,
          }),
        },
      ],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stderr = (error as any)?.stderr?.trim?.();
    return {
      content: [
        {
          type: "text" as const,
          text: `Error creating PR: ${stderr || msg}`,
        },
      ],
      isError: true,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// CheckPackage handler
// ─────────────────────────────────────────────────────────────

export async function handleCheckPackage(
  args: CheckPackageArgs,
  _ctx: MainsToolContext,
) {
  const { guardsService } = await import("../../guards/guards.service");

  if (!args.packages || args.packages.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No packages provided to check." }],
      isError: true,
    };
  }

  const pkgs = args.packages.map((p) => ({
    name: p.name,
    version: p.version,
    ecosystem: (p.ecosystem || "npm") as any,
  }));

  let checks;
  try {
    checks = await guardsService.checkPackages(pkgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Guard check failed: ${message}` }],
      isError: true,
    };
  }

  const lines: string[] = [];
  let hasBlocked = false;

  for (const r of checks) {
    const status = r.allowed ? "✅ ALLOWED" : "❌ BLOCKED";
    if (!r.allowed) hasBlocked = true;

    const scorePart = r.score
      ? ` | score: ${(r.score.overallScore * 100).toFixed(0)}/100 (quality=${r.score.categories.quality ?? "-"}, vulnerability=${r.score.categories.vulnerability ?? "-"}, supplyChain=${r.score.categories.supplyChain ?? "-"})`
      : "";
    const alertPart = r.alerts.length > 0
      ? ` | alerts: ${r.alerts.map((a) => `${a.severity}: ${a.title}`).join(", ")}`
      : "";
    const reasonPart = r.reason ? ` | ${r.reason}` : "";

    lines.push(`${status} ${r.package.name}${scorePart}${alertPart}${reasonPart}`);
  }

  if (hasBlocked) {
    lines.push("\n⚠️ One or more packages were BLOCKED. Do NOT install blocked packages. Inform the user about the security risks.");
  }

  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}
