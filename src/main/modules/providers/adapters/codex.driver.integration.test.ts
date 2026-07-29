import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkRunRequest } from "../../../../shared/adapter.types";

const approvalHarness = vi.hoisted(() => ({
  requests: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../runs/user-input-broker", () => ({
  cancelPendingRequest: vi.fn(),
  cancelPendingRequests: vi.fn(),
  requestToolApproval: vi.fn(async (request: Record<string, unknown>) => {
    approvalHarness.requests.push(request);
    return {
      requestId: request.requestId,
      approved: true,
      answer: "Yes",
    };
  }),
}));

import { createCodexDriver } from "./codex.driver";

const fixtureBinary = path.resolve(
  __dirname,
  "../../../../test/fixtures/fake-codex-app-server.mjs",
);

const drivers: Array<ReturnType<typeof createCodexDriver>> = [];
const tempDirs: string[] = [];

function request(runId: string): WorkRunRequest {
  return {
    runId,
    accountId: "account-1",
    workspace: {
      id: "workspace-1",
      rootPath: process.cwd(),
    },
    goal: "Return structured output",
  };
}

function readProtocolLog(logPath: string): Array<Record<string, unknown>> {
  if (!fs.existsSync(logPath)) return [];
  return fs
    .readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function waitForProtocolMessage(
  logPath: string,
  predicate: (message: Record<string, unknown>) => boolean,
  timeoutMs = 500,
): Promise<Record<string, unknown> | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = readProtocolLog(logPath).find(predicate);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return readProtocolLog(logPath).find(predicate);
}

afterEach(async () => {
  vi.restoreAllMocks();
  approvalHarness.requests.length = 0;
  delete process.env.MAINS_CODEX_FIXTURE_LOG;
  delete process.env.MAINS_CODEX_FIXTURE_VERSION;
  delete process.env.MAINS_CODEX_FIXTURE_LEGACY_INITIALIZE;
  delete process.env.MAINS_CODEX_FIXTURE_PLUGINS_ENABLED;
  delete process.env.MAINS_CODEX_FIXTURE_ACCOUNT;
  await Promise.all(drivers.splice(0).map((driver) => driver.shutdown?.()));
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("codex.driver / app-server protocol", () => {
  it("identifies the real Mains version during initialization", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 2000,
    });
    drivers.push(driver);

    await driver.createSession(request("run-client-version"));

    const initialize = readProtocolLog(logPath).find(
      (message) => message.method === "initialize",
    );
    expect(initialize?.params).toMatchObject({
      clientInfo: {
        name: "mains",
        title: "Mains Desktop",
        version: "0.4.2",
      },
    });
  });

  it("rejects Codex CLI versions older than the supported protocol", async () => {
    process.env.MAINS_CODEX_FIXTURE_VERSION = "0.145.0";

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 2000,
    });
    drivers.push(driver);

    await expect(
      driver.createSession(request("run-old-codex")),
    ).rejects.toThrow(
      "Codex CLI 0.145.0 is not supported. Mains requires 0.146.0 or newer.",
    );
  });

  it("reports an unsupported Codex CLI in account health metadata", async () => {
    process.env.MAINS_CODEX_FIXTURE_VERSION = "0.145.0";

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 2000,
    });
    drivers.push(driver);

    const accountInfo = await driver.getAccountInfo?.();

    expect(accountInfo?.cli).toMatchObject({
      version: "0.145.0",
      outdated: true,
      compatibility: "unsupported",
      minimumVersion: "0.146.0",
      testedProtocolVersion: "0.146.0",
    });
  });

  it("allows a newer CLI in forward-compatible mode and reports a warning", async () => {
    process.env.MAINS_CODEX_FIXTURE_VERSION = "0.147.0";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 2000,
    });
    drivers.push(driver);

    const accountInfo = await driver.getAccountInfo?.();

    expect(accountInfo?.cli).toMatchObject({
      version: "0.147.0",
      outdated: false,
      compatibility: "newer",
      testedProtocolVersion: "0.146.0",
    });
    expect(warn).toHaveBeenCalledWith(
      "[CodexDriver]",
      expect.stringContaining(
        "newer than Mains' tested app-server schema 0.146.0",
      ),
    );
    warn.mockRestore();
  });

  it("maps current account variants and complete rate-limit responses", async () => {
    process.env.MAINS_CODEX_FIXTURE_ACCOUNT = "bedrock";
    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 2000,
    });
    drivers.push(driver);

    const accountInfo = await driver.getAccountInfo?.();
    const rateLimits = await driver.getRateLimits?.();

    expect(accountInfo?.account).toEqual({
      type: "amazonBedrock",
      usesCodexManagedCredentials: true,
    });
    expect(rateLimits).toMatchObject({
      limitId: "codex",
      primary: { usedPercent: 10 },
      rateLimitsByLimitId: {
        codex: {
          limitId: "codex",
          primary: { usedPercent: 10 },
        },
      },
      rateLimitResetCredits: {
        availableCount: 1,
      },
    });
  });

  it("rejects an app-server that does not expose the current initialize contract", async () => {
    process.env.MAINS_CODEX_FIXTURE_LEGACY_INITIALIZE = "1";

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 2000,
    });
    drivers.push(driver);

    await expect(
      driver.createSession(request("run-legacy-initialize")),
    ).rejects.toThrow(
      "Codex app-server initialize response is incompatible with protocol 0.146.0",
    );
  });

  it("scopes skill discovery to the requested workspace", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 2000,
    });
    drivers.push(driver);

    await driver.listSkills?.(tempDir);

    const skillsList = readProtocolLog(logPath).find(
      (message) => message.method === "skills/list",
    );
    expect(skillsList?.params).toEqual({
      cwds: [tempDir],
      forceReload: true,
    });
  });

  it("does not call plugin RPCs when the Codex plugins feature is disabled", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;
    process.env.MAINS_CODEX_FIXTURE_PLUGINS_ENABLED = "0";

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 2000,
    });
    drivers.push(driver);

    const result = await driver.listPlugins?.();

    expect(result).toMatchObject({
      marketplaces: [],
      remoteSyncError: "Codex plugins feature is disabled or unavailable.",
    });
    expect(readProtocolLog(logPath)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "experimentalFeature/list" }),
      ]),
    );
    expect(readProtocolLog(logPath)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "plugin/list" }),
      ]),
    );
  });

  it("forwards the selected structured-output schema as outputSchema", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const schema = {
      type: "object",
      properties: { answer: { type: "string" } },
      required: ["answer"],
    };
    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 2000,
      structuredOutputs: {
        result: {
          id: "result",
          name: "Result",
          schema,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      structuredOutputsSelectedId: "result",
    });
    drivers.push(driver);

    const acquired = await driver.createSession(request("run-output-schema"));
    const outcome = await driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async () => undefined,
      new AbortController().signal,
    );

    expect(outcome.status).toBe("succeeded");
    const turnStart = readProtocolLog(logPath).find(
      (message) => message.method === "turn/start",
    );
    expect(turnStart?.params).toMatchObject({ outputSchema: schema });
    expect(turnStart?.params).not.toHaveProperty("output_schema");
  });

  it("reports usage from thread/tokenUsage/updated", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    process.env.MAINS_CODEX_FIXTURE_LOG = path.join(tempDir, "protocol.jsonl");

    const driver = createCodexDriver({
      binary: fixtureBinary,
      defaultModel: "gpt-5.4",
      timeout: 2000,
    });
    drivers.push(driver);

    const acquired = await driver.createSession(request("run-token-usage"));
    const outcome = await driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async () => undefined,
      new AbortController().signal,
    );

    expect(outcome).toMatchObject({
      status: "succeeded",
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: 2,
        cacheWriteTokens: 1,
        numTurns: 1,
        model: "gpt-5.4",
      },
    });
  });

  it("maps the current request_user_input question shape", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 2000,
    });
    drivers.push(driver);

    const userInputRequest = request("run-user-input");
    userInputRequest.goal = "ask user";
    const acquired = await driver.createSession(userInputRequest);
    const outcome = await driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async () => undefined,
      new AbortController().signal,
    );

    expect(outcome.status).toBe("succeeded");
    expect(approvalHarness.requests).toContainEqual(
      expect.objectContaining({
        runId: "run-user-input",
        kind: "ask_user",
        header: "Confirm",
        question: "Proceed with the plan?",
        isOther: true,
        isSecret: true,
        autoResolutionMs: 60_000,
        options: [{
          label: "Yes",
          description: "Continue the plan.",
        }],
      }),
    );
    const response = await waitForProtocolMessage(
      logPath,
      (message) => message.id === 900 && !("method" in message),
    );
    expect(response).toMatchObject({
      result: {
        answers: {
          confirm: { answers: ["Yes"] },
        },
      },
    });
  });

  it("follows the reviewThreadId returned for a detached review", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      defaultModel: "gpt-5.4",
      timeout: 500,
    });
    drivers.push(driver);

    const acquired = await driver.reviewSession?.({
      runId: "run-detached-review",
      accountId: "account-1",
      workspace: {
        id: "workspace-1",
        rootPath: process.cwd(),
      },
      target: { type: "uncommittedChanges" },
      delivery: "detached",
      model: "gpt-5.4",
    });
    expect(acquired).toBeDefined();

    const events: unknown[] = [];
    const outcome = await driver.executePrompt(
      acquired!.session,
      acquired!.prompt,
      async (event) => {
        events.push(event);
      },
      new AbortController().signal,
    );

    expect(outcome.status).toBe("succeeded");
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "artifact",
        content: "Review complete.",
      }),
    );
    await driver.cleanup?.(acquired!.session);
    const reviewStart = readProtocolLog(logPath).find(
      (message) => message.method === "review/start",
    );
    expect(reviewStart?.params).not.toHaveProperty("model");
    const unsubscribedThreadIds = readProtocolLog(logPath)
      .filter((message) => message.method === "thread/unsubscribe")
      .map((message) => (
        message.params as { threadId?: string } | undefined
      )?.threadId);
    expect(unsubscribedThreadIds).toEqual([
      "thread-1",
      "thread-1-review",
    ]);
  });

  it("uses the generated thread/fork contract without obsolete fields", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
      personality: "friendly",
    });
    drivers.push(driver);

    await driver.createSession(request("run-fork-source"));
    const acquired = await driver.forkSession?.({
      runId: "run-fork-target",
      sourceRunId: "run-fork-source",
      accountId: "account-1",
      workspace: {
        id: "workspace-1",
        rootPath: process.cwd(),
      },
      message: "continue from the fork",
      model: "gpt-5.4",
    });
    expect(acquired).toBeDefined();

    const outcome = await driver.executePrompt(
      acquired!.session,
      acquired!.prompt,
      async () => undefined,
      new AbortController().signal,
    );

    expect(outcome.status).toBe("succeeded");
    const forkRequest = readProtocolLog(logPath).find(
      (message) => message.method === "thread/fork",
    );
    expect(forkRequest?.params).toMatchObject({
      threadId: "thread-1",
      model: "gpt-5.4",
    });
    expect(forkRequest?.params).not.toHaveProperty("personality");

    const turnStart = readProtocolLog(logPath).find(
      (message) =>
        message.method === "turn/start" &&
        (message.params as { threadId?: string } | undefined)?.threadId ===
          "thread-1-fork",
    );
    expect(turnStart?.params).toMatchObject({
      input: [
        expect.objectContaining({
          type: "text",
          text_elements: [],
        }),
      ],
    });
  });

  it("preserves general context when continuing a session", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mains-codex-driver-"),
    );
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);
    await driver.createSession(request("run-continue-context"));

    const acquired = await driver.resumeSession?.({
      runId: "run-continue-context",
      accountId: "account-1",
      workspace: {
        id: "workspace-1",
        rootPath: process.cwd(),
      },
      message: "Continue with this evidence",
      context: [{
        kind: "file",
        ref: "src/auth.ts",
        content: "export const authEnabled = true;",
      }],
    });
    expect(acquired).toBeDefined();
    await driver.executePrompt(
      acquired!.session,
      acquired!.prompt,
      async () => undefined,
      new AbortController().signal,
    );

    const turnStart = readProtocolLog(logPath).find(
      (message) => message.method === "turn/start",
    );
    const input = (
      turnStart?.params as {
        input?: Array<{ type?: string; text?: string }>;
      } | undefined
    )?.input;
    expect(input?.[0]?.text).toContain(
      "[file: src/auth.ts]\nexport const authEnabled = true;",
    );
    expect(input?.[0]?.text).toContain(
      "Continue with this evidence",
    );
  });

  it("preserves general context when forking a session", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mains-codex-driver-"),
    );
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);
    await driver.createSession(request("run-fork-context-source"));

    const acquired = await driver.forkSession?.({
      runId: "run-fork-context-target",
      sourceRunId: "run-fork-context-source",
      accountId: "account-1",
      workspace: {
        id: "workspace-1",
        rootPath: process.cwd(),
      },
      message: "Fork with this evidence",
      context: [{
        kind: "diff",
        ref: "HEAD~1",
        content: "+ const enabled = true;",
      }],
    });
    expect(acquired).toBeDefined();
    await driver.executePrompt(
      acquired!.session,
      acquired!.prompt,
      async () => undefined,
      new AbortController().signal,
    );

    const turnStart = readProtocolLog(logPath).find(
      (message) =>
        message.method === "turn/start" &&
        (
          message.params as { threadId?: string } | undefined
        )?.threadId === "thread-1-fork",
    );
    const input = (
      turnStart?.params as {
        input?: Array<{ type?: string; text?: string }>;
      } | undefined
    )?.input;
    expect(input?.[0]?.text).toContain(
      "[diff: HEAD~1]\n+ const enabled = true;",
    );
    expect(input?.[0]?.text).toContain(
      "Fork with this evidence",
    );
  });

  it("routes concurrent run events by thread without handler interference", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    process.env.MAINS_CODEX_FIXTURE_LOG = path.join(tempDir, "protocol.jsonl");

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);

    const requestA = request("run-parallel-a");
    requestA.goal = "parallel slow A";
    const requestB = request("run-parallel-b");
    requestB.goal = "parallel fast B";
    const [acquiredA, acquiredB] = await Promise.all([
      driver.createSession(requestA),
      driver.createSession(requestB),
    ]);
    const eventsA: unknown[] = [];
    const eventsB: unknown[] = [];

    const [outcomeA, outcomeB] = await Promise.all([
      driver.executePrompt(
        acquiredA.session,
        acquiredA.prompt,
        async (event) => {
          eventsA.push(event);
        },
        new AbortController().signal,
      ),
      driver.executePrompt(
        acquiredB.session,
        acquiredB.prompt,
        async (event) => {
          eventsB.push(event);
        },
        new AbortController().signal,
      ),
    ]);

    expect(outcomeA.status).toBe("succeeded");
    expect(outcomeB.status).toBe("succeeded");
    expect(eventsA.some((event) => (
      event as { content?: string }
    ).content === "parallel slow A")).toBe(true);
    expect(eventsA.some((event) => (
      event as { content?: string }
    ).content === "parallel fast B")).toBe(false);
    expect(eventsB.some((event) => (
      event as { content?: string }
    ).content === "parallel fast B")).toBe(true);
    expect(eventsB.some((event) => (
      event as { content?: string }
    ).content === "parallel slow A")).toBe(false);
  });

  it("waits for the parent turn after a subagent turn completes", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mains-codex-driver-"),
    );
    tempDirs.push(tempDir);
    process.env.MAINS_CODEX_FIXTURE_LOG = path.join(
      tempDir,
      "protocol.jsonl",
    );

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);
    const subagentRequest = request("run-subagent-completion");
    subagentRequest.goal = "subagent completion";
    const acquired = await driver.createSession(subagentRequest);
    let settled = false;
    const outcomePromise = driver
      .executePrompt(
        acquired.session,
        acquired.prompt,
        async () => undefined,
        new AbortController().signal,
      )
      .finally(() => {
        settled = true;
      });

    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(settled).toBe(false);
    await expect(outcomePromise).resolves.toMatchObject({
      status: "succeeded",
    });
  });

  it("finalizes duplicate parent completion notifications once", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mains-codex-driver-"),
    );
    tempDirs.push(tempDir);
    process.env.MAINS_CODEX_FIXTURE_LOG = path.join(
      tempDir,
      "protocol.jsonl",
    );

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);
    const duplicateRequest = request("run-duplicate-completion");
    duplicateRequest.goal = "duplicate completion";
    const acquired = await driver.createSession(duplicateRequest);
    const events: Array<Record<string, unknown>> = [];

    const outcome = await driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async (event) => {
        events.push(event as unknown as Record<string, unknown>);
      },
      new AbortController().signal,
    );

    expect(outcome.status).toBe("succeeded");
    expect(
      events.filter(
        (event) =>
          event.content === "Final answer" &&
          event.ephemeral !== true,
      ),
    ).toHaveLength(1);
  });

  it("keeps a replacement driver session alive when the previous driver shuts down", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mains-codex-driver-"),
    );
    tempDirs.push(tempDir);
    process.env.MAINS_CODEX_FIXTURE_LOG = path.join(
      tempDir,
      "protocol.jsonl",
    );

    const previousDriver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    const replacementDriver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(previousDriver, replacementDriver);

    await previousDriver.createSession(
      request("run-previous-driver"),
    );
    await replacementDriver.createSession(
      request("run-replacement-driver"),
    );

    await previousDriver.shutdown?.();

    await expect(
      replacementDriver.canResumeSession?.(
        "run-replacement-driver",
      ),
    ).resolves.toBe(true);
  });

  it("does not start a turn when execution is already aborted", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mains-codex-driver-"),
    );
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);

    const acquired = await driver.createSession(
      request("run-already-aborted"),
    );
    const abortController = new AbortController();
    abortController.abort();

    const outcome = await driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async () => undefined,
      abortController.signal,
    );

    expect(outcome.status).toBe("canceled");
    expect(
      readProtocolLog(logPath).filter(
        (message) => message.method === "turn/start",
      ),
    ).toHaveLength(0);
  });

  it("interrupts the Codex turn when execution times out", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mains-codex-driver-"),
    );
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 40,
    });
    drivers.push(driver);
    const timeoutRequest = request("run-timeout-interrupt");
    timeoutRequest.goal = "timeout turn";
    const acquired = await driver.createSession(timeoutRequest);

    const outcome = await driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async () => undefined,
      new AbortController().signal,
    );

    expect(outcome).toMatchObject({
      status: "failed",
      summary: "Codex run timed out after 40ms",
    });
    expect(
      readProtocolLog(logPath).find(
        (message) => message.method === "turn/interrupt",
      )?.params,
    ).toEqual({
      threadId: "thread-1",
      turnId: "turn-thread-1",
    });
  });

  it("finalizes an aborted active turn without waiting for timeout", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mains-codex-driver-"),
    );
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);
    const abortRequest = request("run-active-abort");
    abortRequest.goal = "timeout turn";
    const acquired = await driver.createSession(abortRequest);
    const abortController = new AbortController();
    const startedAt = Date.now();
    const outcomePromise = driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async () => undefined,
      abortController.signal,
    );

    await waitForProtocolMessage(
      logPath,
      (message) => message.method === "turn/start",
    );
    await new Promise((resolve) => setTimeout(resolve, 25));
    abortController.abort();
    const outcome = await outcomePromise;

    expect(outcome.status).toBe("canceled");
    expect(Date.now() - startedAt).toBeLessThan(300);
    expect(
      readProtocolLog(logPath).some(
        (message) => message.method === "turn/interrupt",
      ),
    ).toBe(true);
  });

  it(
    "fails pending RPCs immediately when app-server exits",
    async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
      tempDirs.push(tempDir);
      process.env.MAINS_CODEX_FIXTURE_LOG = path.join(tempDir, "protocol.jsonl");

      const driver = createCodexDriver({
        binary: fixtureBinary,
        timeout: 500,
      });
      drivers.push(driver);

      const crashRequest = request("run-crash");
      crashRequest.goal = "crash before response";
      const acquired = await driver.createSession(crashRequest);
      const startedAt = Date.now();
      const outcome = await driver.executePrompt(
        acquired.session,
        acquired.prompt,
        async () => undefined,
        new AbortController().signal,
      );

      expect(outcome.status).toBe("failed");
      expect(outcome.summary).toMatch(/app-server.*(?:exit|close)/i);
      expect(Date.now() - startedAt).toBeLessThan(1000);
    },
    35_000,
  );

  it("surfaces managed-network context in command approvals", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    process.env.MAINS_CODEX_FIXTURE_LOG = path.join(tempDir, "protocol.jsonl");

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);

    const networkRequest = request("run-network-approval");
    networkRequest.goal = "network approval";
    const acquired = await driver.createSession(networkRequest);
    const outcome = await driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async () => undefined,
      new AbortController().signal,
    );

    expect(outcome.status).toBe("succeeded");
    expect(approvalHarness.requests).toContainEqual(
      expect.objectContaining({
        runId: "run-network-approval",
        toolName: "Bash",
        toolInput: expect.objectContaining({
          command: "Network access: https://api.example.com",
          networkApprovalContext: {
            host: "api.example.com",
            protocol: "https",
          },
          proposedNetworkPolicyAmendments: [{
            host: "api.example.com",
            action: "allow",
          }],
        }),
      }),
    );
  });

  it("declines a late permission request with the permission response shape", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);

    const lateRequest = request("run-late-permission");
    lateRequest.goal = "late permission";
    const acquired = await driver.createSession(lateRequest);
    const outcome = await driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async () => undefined,
      new AbortController().signal,
    );
    expect(outcome.status).toBe("succeeded");

    const response = await waitForProtocolMessage(
      logPath,
      (message) => message.id === 901 && !("method" in message),
    );
    expect(response).toMatchObject({
      result: {
        permissions: {},
        scope: "turn",
      },
    });
    expect(response?.result).not.toHaveProperty("decision");
  });

  it("safely declines MCP forms whose required values cannot be collected", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);

    const mcpRequest = request("run-mcp-form");
    mcpRequest.goal = "mcp required form";
    const acquired = await driver.createSession(mcpRequest);
    const outcome = await driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async () => undefined,
      new AbortController().signal,
    );
    expect(outcome.status).toBe("succeeded");

    const response = await waitForProtocolMessage(
      logPath,
      (message) => message.id === 903 && !("method" in message),
    );
    expect(response).toMatchObject({
      result: {
        action: "decline",
        content: null,
        _meta: null,
      },
    });
  });

  it("answers currentTime/read with epoch seconds", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-driver-"));
    tempDirs.push(tempDir);
    const logPath = path.join(tempDir, "protocol.jsonl");
    process.env.MAINS_CODEX_FIXTURE_LOG = logPath;

    const driver = createCodexDriver({
      binary: fixtureBinary,
      timeout: 500,
    });
    drivers.push(driver);

    const timeRequest = request("run-current-time");
    timeRequest.goal = "current time";
    const acquired = await driver.createSession(timeRequest);
    const outcome = await driver.executePrompt(
      acquired.session,
      acquired.prompt,
      async () => undefined,
      new AbortController().signal,
    );
    expect(outcome.status).toBe("succeeded");

    const response = await waitForProtocolMessage(
      logPath,
      (message) => message.id === 904 && !("method" in message),
    );
    expect(response?.result).toEqual({
      currentTimeAt: expect.any(Number),
    });
  });
});
