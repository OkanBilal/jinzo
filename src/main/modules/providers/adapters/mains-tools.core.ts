// ─────────────────────────────────────────────────────────────
// Mains MCP Tools — Shared handler logic
//
// Both Claude and Copilot adapters expose the same five mains tools.
// This module holds the handler implementations and descriptions;
// each adapter wraps them into its SDK-specific format.
// ─────────────────────────────────────────────────────────────

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { workspaceRepo, logWorkspaceActivity } from "../../workspace";
import { runSessionRegistry } from "../../runs/run-session-registry";
import { gitService } from "../../git/git.service";
import { projectsRepo } from "../../projects/projects.repo";
import { appSettingsRepo } from "../../appSettings/appSettings.repo";
import { SETTINGS_ID } from "../../appSettings/appSettings.constants";

const execFileAsync = promisify(execFile);

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
  args: { runId?: string },
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
  args: {
    title: string;
    summary?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  },
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
  }

  return {
    content: [
      { type: "text" as const, text: JSON.stringify({ findingIds }) },
    ],
  };
}

export async function handleCommitChanges(
  args: { message?: string; files?: string[] },
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
    // Fetch commit instructions (project-level > app-level)
    let commitInstructions: string | null = null;
    if (ctx.workspaceId) {
      const workspace = await workspaceRepo.findById(ctx.workspaceId);
      if (workspace?.projectId) {
        const project = await projectsRepo.findById(workspace.projectId);
        commitInstructions = project?.commitInstructions ?? null;
      }
    }
    if (!commitInstructions) {
      const settings = await appSettingsRepo.findById(SETTINGS_ID);
      commitInstructions = settings?.commitInstructions ?? null;
    }

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

      await workspaceRepo.deleteDiffsByWorkspace(ctx.workspaceId);
      if (untrackedFiles.length > 0 || diffText) {
        await workspaceRepo.insertDiff({
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
      runSessionRegistry.get(ctx.runId)?.updateBaseRef(newHead);
    }

    // Clear review findings for this workspace — committed code is accepted
    if (ctx.workspaceId) {
      await workspaceRepo.deleteFindingsByWorkspace(ctx.workspaceId);
    }

    if (ctx.workspaceId) {
      logWorkspaceActivity({
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

export async function handleCreatePR(
  args: {
    title: string;
    body?: string;
    base?: string;
    draft?: boolean;
    labels?: string[];
  },
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
    // Fetch project and verify remote origin
    let prInstructions: string | null = null;
    if (ctx.workspaceId) {
      const workspace = await workspaceRepo.findById(ctx.workspaceId);
      if (workspace?.projectId) {
        const project = await projectsRepo.findById(workspace.projectId);
        prInstructions = project?.prInstructions ?? null;

        // Verify the working directory's remote matches the project's expected remote
        if (project?.remoteOrigin) {
          const remotesResult = await gitService.getRemotes(ctx.rootPath);
          if (remotesResult.success && remotesResult.data) {
            const origin = remotesResult.data.find((r) => r.name === "origin");
            const currentRemote = origin?.fetchUrl || origin?.pushUrl;
            if (currentRemote && normalizeGitUrl(currentRemote) !== normalizeGitUrl(project.remoteOrigin)) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Error: Remote origin mismatch. Expected "${project.remoteOrigin}" but found "${currentRemote}". Aborting to prevent creating a PR in the wrong repository.`,
                  },
                ],
                isError: true,
              };
            }
          }
        }
      }
    }
    if (!prInstructions) {
      const settings = await appSettingsRepo.findById(SETTINGS_ID);
      prInstructions = settings?.prInstructions ?? null;
    }

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

    // Detect current branch to pass --head explicitly.
    // In worktrees, upstream tracking may not be set even after push,
    // so gh can't infer the head branch automatically.
    const branchResult = await gitService.getCurrentBranch(ctx.rootPath);
    const currentBranch = branchResult.success ? branchResult.data : null;

    const ghArgs = ["pr", "create", "--title", args.title];

    if (currentBranch) {
      ghArgs.push("--head", currentBranch);
    }
    if (args.body) {
      ghArgs.push("--body", args.body);
    }
    if (args.base) {
      ghArgs.push("--base", args.base);
    }
    if (args.draft) {
      ghArgs.push("--draft");
    }
    if (args.labels && args.labels.length > 0) {
      for (const label of args.labels) {
        ghArgs.push("--label", label);
      }
    }

    const { stdout, stderr } = await execFileAsync("gh", ghArgs, {
      cwd: ctx.rootPath,
      timeout: 30_000,
    });

    const output = stdout.trim();
    const prUrl = output.match(/https:\/\/github\.com\/[^\s]+/)?.[0];

    if (ctx.workspaceId) {
      logWorkspaceActivity({
        workspaceId: ctx.workspaceId,
        type: "pr",
        title: args.title,
        summary: args.body,
        refId: prUrl ?? undefined,
        metadata: {
          base: args.base,
          draft: args.draft,
          labels: args.labels,
        },
      });
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            url: prUrl ?? output,
            stdout: output,
            stderr: stderr?.trim() || undefined,
          }),
        },
      ],
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : String(error);
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

/**
 * Normalize a git remote URL so SSH and HTTPS variants match.
 * e.g. "git@github.com:user/repo.git" and "https://github.com/user/repo.git"
 * both become "github.com/user/repo".
 */
function normalizeGitUrl(url: string): string {
  return url
    .replace(/^(https?:\/\/|git@|ssh:\/\/git@)/, "")
    .replace(/:(\d+\/)?/, "/")
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

// ─────────────────────────────────────────────────────────────
// CheckPackage handler
// ─────────────────────────────────────────────────────────────

export async function handleCheckPackage(
  args: {
    packages: Array<{ name: string; version?: string; ecosystem?: string }>;
  },
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

  const result = await guardsService.checkPackages(pkgs);
  if (!result.success) {
    return {
      content: [{ type: "text" as const, text: `Guard check failed: ${result.error}` }],
      isError: true,
    };
  }

  const lines: string[] = [];
  let hasBlocked = false;

  for (const r of result.data) {
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
