import fs from "fs";
import path from "path";
import os from "os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_DATA = path.join(os.tmpdir(), "mains-run-execution-test");

vi.mock("electron", () => ({
  app: { getPath: () => TEST_USER_DATA },
}));

import {
  managedExecutionRoots,
  managedRunDir,
  resolveRunExecution,
} from "./run-execution";

describe("resolveRunExecution", () => {
  beforeEach(() => fs.rmSync(TEST_USER_DATA, { recursive: true, force: true }));
  afterEach(() => fs.rmSync(TEST_USER_DATA, { recursive: true, force: true }));

  it("uses a real Workspace unchanged", () => {
    expect(
      resolveRunExecution({
        runId: "developer-run",
        mode: "developer",
        workspace: { id: "ws-1", rootPath: "/repo/mains" },
      }),
    ).toEqual({ workspaceId: "ws-1", cwd: "/repo/mains" });
  });

  it("creates one durable directory per Work run", () => {
    const first = resolveRunExecution({ runId: "work-1", mode: "work" });
    const second = resolveRunExecution({ runId: "work-2", mode: "work" });

    expect(first.cwd).toBe(path.join(TEST_USER_DATA, "runs", "work-1", "work"));
    expect(second.cwd).not.toBe(first.cwd);
    expect(fs.statSync(first.cwd).isDirectory()).toBe(true);
  });

  it("shares one neutral directory for Chat runs", () => {
    const first = resolveRunExecution({ runId: "chat-1", mode: "chat" });
    const second = resolveRunExecution({ runId: "chat-2", mode: "chat" });

    expect(first).toEqual({
      workspaceId: null,
      cwd: path.join(TEST_USER_DATA, "runtime", "chat"),
    });
    expect(second.cwd).toBe(first.cwd);
  });

  it("rejects a Developer run without a Workspace", () => {
    expect(() =>
      resolveRunExecution({ runId: "bad-dev", mode: "developer" }),
    ).toThrow("require a workspace");
  });
});

describe("managedRunDir", () => {
  it("gives each Work run its own directory without creating it", () => {
    // The file explorer and the renderer's file-open resolve paths against
    // this; only the run itself should be making directories.
    const dir = managedRunDir("work-42", "work");

    expect(dir).toBe(path.join(TEST_USER_DATA, "runs", "work-42", "work"));
    expect(fs.existsSync(dir)).toBe(false);
  });

  it("shares one directory across Chat runs", () => {
    expect(managedRunDir("chat-1", "chat")).toBe(
      managedRunDir("chat-2", "chat"),
    );
  });

  it("rejects a run id that would escape the runs directory", () => {
    expect(() => managedRunDir("../escape", "work")).toThrow();
  });
});

describe("managedExecutionRoots", () => {
  it("covers both managed directories with the runs parent", () => {
    const roots = managedExecutionRoots();

    expect(roots).toContain(path.join(TEST_USER_DATA, "runs"));
    expect(roots).toContain(path.join(TEST_USER_DATA, "runtime", "chat"));
    // Every Work run sits under the first entry, so one root admits them all.
    expect(managedRunDir("any-run", "work").startsWith(roots[0])).toBe(true);
  });
});
