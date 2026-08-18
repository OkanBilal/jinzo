import fs from "fs";
import path from "path";
import { app } from "electron";
import type { ModeId } from "../../../shared/modes";
import type { RunExecutionContext } from "../../../shared/adapter.types";

interface WorkspaceExecutionSource {
  id: string;
  rootPath: string;
}

function userDataRoot(): string {
  return app?.getPath("userData") || path.join(process.cwd(), ".data");
}

function assertSafeRunId(runId: string): void {
  if (!runId || runId === "." || runId === ".." || /[\\/]/.test(runId)) {
    throw new Error("Invalid run id for managed working directory");
  }
}

/**
 * Resolve the explicit cwd handed to every provider adapter.
 *
 * Developer and legacy non-developer runs keep their real Workspace path.
 * New Work runs get a durable per-run directory; Chat shares one neutral cwd.
 */
export function resolveRunExecution(args: {
  runId: string;
  mode: ModeId;
  workspace?: WorkspaceExecutionSource | null;
}): RunExecutionContext {
  if (args.workspace) {
    return {
      cwd: args.workspace.rootPath,
      workspaceId: args.workspace.id,
    };
  }
  if (args.mode === "developer") {
    throw new Error("Developer runs require a workspace");
  }

  const cwd =
    args.mode === "work"
      ? (() => {
          assertSafeRunId(args.runId);
          return path.join(userDataRoot(), "runs", args.runId, "work");
        })()
      : path.join(userDataRoot(), "runtime", "chat");
  fs.mkdirSync(cwd, { recursive: true });
  return { cwd, workspaceId: null };
}
