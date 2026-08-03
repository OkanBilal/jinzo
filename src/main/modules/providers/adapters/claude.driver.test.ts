// ─────────────────────────────────────────────────────────────
// Pure-function tests for claude.driver.
//
// The Claude SDK is loaded via dynamic import and not exercised here —
// integration tests would require the actual @anthropic-ai/claude-agent-sdk.
// These tests cover the permission bridge and deterministic outcome classifier
// without starting a real Claude CLI session.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from "vitest";
import {
  buildClaudePermissionModeOptions,
  buildClaudeExecutableOptions,
  classifyOutcome,
  createClaudePermissionBridge,
  createClaudeElicitationHandler,
  removeClaudeRuntimeSettings,
  writeClaudeRuntimeSettings,
  mapClaudePluginList,
  mapClaudePluginDetail,
  cleanGeneratedTitle,
  parseSimpleYaml,
  mapTaskMessage,
} from "./claude.driver";
import type { ClaudeTaskIndex, SDKSystemMessage } from "./claude.driver";
import fs from "node:fs";
import {
  ALLOWED_TOOLS_SET,
  DEFAULT_ALLOWED_TOOLS,
} from "./adapter.shared";

const DEFAULT_TIMEOUT = 6_000_000;
const INHERITED_PERMISSION_SETTINGS = {
  permissions: {
    allow: DEFAULT_ALLOWED_TOOLS,
  },
};

describe("claude.driver / skill frontmatter", () => {
  it("folds multiline YAML descriptions into readable text", () => {
    const parsed = parseSimpleYaml(
      [
        "name: creating-skills",
        "description: >",
        "  Design and build Recursive skills — folder-based extensions that give agents",
        "  specialized knowledge, workflows, and tools.",
        "user-invokable: true",
      ].join("\n"),
    );

    expect(parsed).toMatchObject({
      name: "creating-skills",
      description:
        "Design and build Recursive skills — folder-based extensions that give agents specialized knowledge, workflows, and tools.",
      "user-invokable": true,
    });
  });

  it("preserves line breaks for literal YAML descriptions", () => {
    const parsed = parseSimpleYaml(
      [
        "name: literal-skill",
        "description: |-",
        "  First line.",
        "  Second line.",
        "disable-model-invocation: false",
      ].join("\n"),
    );

    expect(parsed.description).toBe("First line.\nSecond line.");
    expect(parsed["disable-model-invocation"]).toBe(false);
  });
});

describe("claude.driver / permission mode options", () => {
  it("uses the SDK-matched bundled CLI unless a binary override is explicit", () => {
    expect(buildClaudeExecutableOptions()).toEqual({});
    expect(buildClaudeExecutableOptions(process.execPath)).toEqual({
      pathToClaudeCodeExecutable: process.execPath,
    });
    expect(buildClaudeExecutableOptions(undefined, process.execPath)).toEqual({
      pathToClaudeCodeExecutable: process.execPath,
    });
  });

  it("acknowledges bypassPermissions so detached agents can inherit bypass mode", () => {
    expect(buildClaudePermissionModeOptions("bypassPermissions")).toEqual({
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      allowedTools: DEFAULT_ALLOWED_TOOLS,
      settings: INHERITED_PERMISSION_SETTINGS,
    });
  });

  it("does not enable dangerous permission skipping for other modes", () => {
    const defaultOptions = buildClaudePermissionModeOptions("default");
    const planOptions = buildClaudePermissionModeOptions("plan");

    expect(defaultOptions).toEqual({
      permissionMode: "default",
      allowedTools: DEFAULT_ALLOWED_TOOLS,
      settings: INHERITED_PERMISSION_SETTINGS,
    });
    expect(planOptions).toEqual({
      permissionMode: "plan",
      allowedTools: DEFAULT_ALLOWED_TOOLS,
      settings: INHERITED_PERMISSION_SETTINGS,
    });
    expect(defaultOptions.allowDangerouslySkipPermissions).toBeUndefined();
    expect(planOptions.allowDangerouslySkipPermissions).toBeUndefined();
  });

  it("keeps the background permission callback attached in bypass mode", () => {
    const canUseTool = vi.fn();

    expect(
      buildClaudePermissionModeOptions("bypassPermissions", canUseTool),
    ).toMatchObject({
      canUseTool,
    });
  });

  it("includes every built-in required by headless workflow agents", () => {
    const options = buildClaudePermissionModeOptions("bypassPermissions");

    expect(options.allowedTools).toEqual(DEFAULT_ALLOWED_TOOLS);
    expect(options.allowedTools).toEqual(
      expect.arrayContaining([
        "Workflow",
        "ToolSearch",
        "WebSearch",
        "WebFetch",
        "StructuredOutput",
      ]),
    );
    expect(options).toMatchObject({
      settings: {
        permissions: {
          allow: DEFAULT_ALLOWED_TOOLS,
        },
      },
    });
  });

  it("materializes and removes a settings snapshot for Workflow inheritance", () => {
    const settings = {
      permissions: {
        allow: ["ToolSearch", "StructuredOutput"],
      },
      ultracode: true,
    };
    const settingsPath = writeClaudeRuntimeSettings(settings);

    try {
      expect(JSON.parse(fs.readFileSync(settingsPath, "utf8"))).toEqual(settings);
      expect(fs.statSync(settingsPath).mode & 0o777).toBe(0o600);
    } finally {
      removeClaudeRuntimeSettings(settingsPath);
    }

    expect(fs.existsSync(settingsPath)).toBe(false);
  });
});

describe("claude.driver / permission bridge", () => {
  it("does not register an in-process PreToolUse hook that Workflow children cannot call", () => {
    const bridge = createClaudePermissionBridge({
      runId: "run-workflow",
      allowedTools: ALLOWED_TOOLS_SET,
      bypassMode: true,
    });

    expect(bridge).toEqual({
      canUseTool: expect.any(Function),
    });
    expect(bridge).not.toHaveProperty("preToolUseHook");
  });

  it("allows a pre-approved tool requested by a background agent through canUseTool", async () => {
    const requestApproval = vi.fn();
    const bridge = createClaudePermissionBridge({
      runId: "run-1",
      allowedTools: new Set(["Read"]),
      bypassMode: false,
      requestApproval,
    });

    await expect(
      bridge.canUseTool(
        "Read",
        { file_path: "/tmp/file.ts" },
        {
          signal: new AbortController().signal,
          toolUseID: "tool-1",
          agentID: "background-agent-1",
          requestId: "permission-1",
        },
      ),
    ).resolves.toEqual({
      behavior: "allow",
      updatedInput: { file_path: "/tmp/file.ts" },
      toolUseID: "tool-1",
    });
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("routes a non-allowlisted background tool through the existing approval broker", async () => {
    const requestApproval = vi.fn().mockResolvedValue({
      requestId: "permission-2",
      approved: true,
    });
    const bridge = createClaudePermissionBridge({
      runId: "run-2",
      allowedTools: new Set(),
      bypassMode: false,
      requestApproval,
    });

    await expect(
      bridge.canUseTool(
        "CustomTool",
        { value: 42 },
        {
          signal: new AbortController().signal,
          toolUseID: "tool-2",
          agentID: "background-agent-2",
          requestId: "permission-2",
        },
      ),
    ).resolves.toEqual({
      behavior: "allow",
      updatedInput: { value: 42 },
      toolUseID: "tool-2",
    });
    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "permission-2",
        runId: "run-2",
        toolName: "CustomTool",
        toolInput: { value: 42 },
        kind: "tool_approval",
      }),
    );
  });

  it("switches the active SDK session to acceptEdits after the user applies the plan", async () => {
    const requestApproval = vi.fn().mockResolvedValue({
      requestId: "plan-approval-1",
      approved: true,
    });
    const bridge = createClaudePermissionBridge({
      runId: "run-plan",
      allowedTools: ALLOWED_TOOLS_SET,
      bypassMode: false,
      requestApproval,
    });

    await expect(
      bridge.canUseTool(
        "ExitPlanMode",
        { plan: "# Proposed plan" },
        {
          signal: new AbortController().signal,
          toolUseID: "tool-plan",
          requestId: "plan-approval-1",
        },
      ),
    ).resolves.toEqual({
      behavior: "allow",
      updatedInput: { plan: "# Proposed plan" },
      updatedPermissions: [
        {
          type: "setMode",
          mode: "acceptEdits",
          destination: "session",
        },
      ],
      toolUseID: "tool-plan",
    });

    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "plan-approval-1",
        toolName: "ExitPlanMode",
        kind: "tool_approval",
      }),
    );
  });

  it("cancels a parked broker request when the SDK permission stream aborts", async () => {
    const requestApproval = vi.fn(
      () => new Promise<never>(() => {}),
    );
    const cancelApproval = vi.fn();
    const abortController = new AbortController();
    const bridge = createClaudePermissionBridge({
      runId: "run-aborted-permission",
      allowedTools: new Set(),
      bypassMode: false,
      requestApproval,
      cancelApproval,
    });

    const result = bridge.canUseTool(
      "AskUserQuestion",
      { questions: [{ question: "Continue?" }] },
      {
        signal: abortController.signal,
        toolUseID: "tool-aborted-permission",
        requestId: "permission-aborted",
      },
    );

    await vi.waitFor(() => {
      expect(requestApproval).toHaveBeenCalledOnce();
    });
    abortController.abort();

    await expect(result).resolves.toEqual({
      behavior: "deny",
      message: "Permission request aborted",
      toolUseID: "tool-aborted-permission",
    });
    expect(cancelApproval).toHaveBeenCalledWith("permission-aborted");
  });
});

describe("claude.driver / classifyOutcome", () => {
  describe("success path", () => {
    it("succeeded with normal stop reason", () => {
      expect(
        classifyOutcome({
          stopReason: "end_turn",
          aborted: false,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "succeeded",
        summary: "Completed successfully",
        stopReason: "end_turn",
        usage: undefined,
      });
    });

    it("succeeded when stopReason is null", () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: false,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "succeeded",
        summary: "Completed successfully",
        stopReason: undefined,
        usage: undefined,
      });
    });

    it("preserves usage on success", () => {
      const usage = { inputTokens: 100, outputTokens: 50, model: "claude-opus" };
      expect(
        classifyOutcome({
          stopReason: "end_turn",
          usage,
          aborted: false,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }).usage,
      ).toBe(usage);
    });

    it("does not report success when the terminal tool result was cancelled", () => {
      expect(
        classifyOutcome({
          stopReason: "end_turn",
          aborted: false,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
          terminalToolNonExecutionKind: "cancelled",
        }),
      ).toEqual({
        status: "failed",
        summary: "Tool execution was cancelled before the run could complete.",
        stopReason: "end_turn",
        usage: undefined,
      });
    });
  });

  describe("refusal", () => {
    it('failed with refusal summary when stop reason is "refusal"', () => {
      expect(
        classifyOutcome({
          stopReason: "refusal",
          aborted: false,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "failed",
        summary: "The model declined to fulfill this request.",
        stopReason: "refusal",
        usage: undefined,
      });
    });
  });

  describe("abort path", () => {
    it("canceled when AbortSignal fired (no error)", () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: true,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "canceled",
        summary: "Run was aborted",
        stopReason: undefined,
        usage: undefined,
      });
    });

    it("canceled when AbortSignal fired even with error message", () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: true,
          timedOut: false,
          errorMessage: "AbortError: aborted",
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "canceled",
        summary: "Run was aborted",
        stopReason: undefined,
        usage: undefined,
      });
    });

    it('canceled when error message includes "aborted" without explicit signal', () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: false,
          timedOut: false,
          errorMessage: "Operation was aborted by upstream",
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "canceled",
        summary: "Run was aborted",
        stopReason: undefined,
        usage: undefined,
      });
    });
  });

  describe("timeout path", () => {
    it("failed with timeout summary when timedOut flag set", () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: true, // timeout aborts the controller too
          timedOut: true,
          timeoutMs: 60_000,
        }),
      ).toEqual({
        status: "failed",
        summary: "Request timed out after 60 seconds.",
        stopReason: undefined,
        usage: undefined,
      });
    });

    it('failed with timeout summary when error message includes "timed out"', () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: false,
          timedOut: false,
          errorMessage: "Request timed out after 30000ms",
          timeoutMs: 30_000,
        }),
      ).toEqual({
        status: "failed",
        summary: "Request timed out after 30 seconds.",
        stopReason: undefined,
        usage: undefined,
      });
    });
  });

  describe("generic failure", () => {
    it("failed with the underlying error message", () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: false,
          timedOut: false,
          errorMessage: "SDK connection lost",
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "failed",
        summary: "SDK connection lost",
        stopReason: undefined,
        usage: undefined,
      });
    });

    it("preserves usage on failure", () => {
      const usage = { inputTokens: 100, outputTokens: 50 };
      expect(
        classifyOutcome({
          stopReason: "tool_use",
          usage,
          aborted: false,
          timedOut: false,
          errorMessage: "boom",
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toMatchObject({
        status: "failed",
        summary: "boom",
        stopReason: "tool_use",
        usage,
      });
    });
  });
});

describe("claude.driver / cleanGeneratedTitle", () => {
  it("returns a clean title unchanged", () => {
    expect(cleanGeneratedTitle("Fix Login Redirect", "goal")).toBe("Fix Login Redirect");
  });

  it("strips surrounding quotes and backticks", () => {
    expect(cleanGeneratedTitle('"Add Dark Mode"', "g")).toBe("Add Dark Mode");
    expect(cleanGeneratedTitle("`Update Icons`", "g")).toBe("Update Icons");
  });

  it('strips a leading "Title:" prefix (case-insensitive)', () => {
    expect(cleanGeneratedTitle("Title: Update Icons", "g")).toBe("Update Icons");
    expect(cleanGeneratedTitle("title:   Refactor Header", "g")).toBe("Refactor Header");
  });

  it("strips trailing sentence punctuation", () => {
    expect(cleanGeneratedTitle("Refactor Header!", "g")).toBe("Refactor Header");
    expect(cleanGeneratedTitle("Why Is This Broken?", "g")).toBe("Why Is This Broken");
  });

  it("keeps only the first line", () => {
    expect(cleanGeneratedTitle("Best Title\nignored explanation here", "g")).toBe("Best Title");
  });

  it("falls back to the goal when the model output is empty or whitespace", () => {
    expect(cleanGeneratedTitle("", "My Goal Here")).toBe("My Goal Here");
    expect(cleanGeneratedTitle("   ", "Fallback Goal")).toBe("Fallback Goal");
  });

  it("caps the result at 50 characters", () => {
    const long = "A".repeat(120);
    expect(cleanGeneratedTitle(long, "goal").length).toBe(50);
  });
});

describe("claude.driver / mapClaudePluginList", () => {
  it("returns an empty response for null inputs", () => {
    expect(mapClaudePluginList(null, null)).toEqual({
      marketplaces: [],
      marketplaceLoadErrors: [],
      remoteSyncError: null,
      featuredPluginIds: [],
    });
  });

  it("groups available plugins under their marketplace and overlays installed state", () => {
    const list = {
      installed: [
        { id: "frontend-design@official", enabled: true, installPath: "/p/fd", scope: "user" },
      ],
      available: [
        {
          pluginId: "frontend-design@official",
          name: "frontend-design",
          description: "UI design helper",
          marketplaceName: "official",
          source: { source: "git-subdir", url: "https://github.com/x/y.git", path: "plugins/fd" },
        },
        {
          pluginId: "api-security@official",
          name: "api-security",
          description: "API scanner",
          marketplaceName: "official",
          source: { source: "git-subdir", url: "https://github.com/a/b.git" },
        },
      ],
    };
    const marketplaces = [
      { name: "official", source: "github", repo: "anthropics/official", installLocation: "/m/official" },
    ];

    const res = mapClaudePluginList(list, marketplaces);
    expect(res.marketplaces).toHaveLength(1);
    const mp = res.marketplaces[0];
    expect(mp).toMatchObject({ name: "official", path: "/m/official", interface: null });
    expect(mp.plugins).toHaveLength(2);

    const fd = mp.plugins.find((p) => p.id === "frontend-design@official")!;
    expect(fd).toMatchObject({
      name: "frontend-design",
      installed: true,
      enabled: true,
      installPolicy: "AVAILABLE",
      authPolicy: "ON_INSTALL",
      source: { type: "git-subdir", path: "https://github.com/x/y.git" },
    });
    expect(fd.interface).toMatchObject({ shortDescription: "UI design helper", capabilities: [], screenshots: [] });

    const api = mp.plugins.find((p) => p.id === "api-security@official")!;
    expect(api).toMatchObject({ installed: false, enabled: false });
  });

  it("enriches plugin interface with category/developer/homepage from the catalog", () => {
    const list = {
      available: [
        { pluginId: "fd@official", name: "fd", marketplaceName: "official", source: {} },
      ],
    };
    const catalog = {
      "fd@official": {
        marketplace_entry: {
          displayName: "Front End",
          description: "Catalog description",
          category: "development",
          author: { name: "Anthropic" },
          homepage: "https://example.com",
        },
      },
    };
    const res = mapClaudePluginList(list, [], catalog);
    const p = res.marketplaces[0].plugins[0];
    expect(p.interface).toMatchObject({
      displayName: "Front End",
      category: "development",
      developerName: "Anthropic",
      websiteUrl: "https://example.com",
      shortDescription: "Catalog description",
    });
  });

  it("leaves displayName undefined when the catalog has none (UI humanizes the slug)", () => {
    const res = mapClaudePluginList(
      { available: [{ pluginId: "agent-sdk-dev@official", name: "agent-sdk-dev", source: {} }] },
      [],
    );
    expect(res.marketplaces[0].plugins[0].interface?.displayName).toBeUndefined();
  });

  it("derives the marketplace from the id when none is configured", () => {
    const res = mapClaudePluginList(
      { available: [{ pluginId: "foo@bar", name: "foo", source: {} }] },
      null,
    );
    expect(res.marketplaces.map((m) => m.name)).toContain("bar");
    expect(res.marketplaces[0].plugins[0]).toMatchObject({
      id: "foo@bar",
      source: { type: "git", path: "" },
      interface: null,
    });
  });

  it("surfaces installed plugins absent from the catalog under their id-derived marketplace", () => {
    const res = mapClaudePluginList(
      { installed: [{ id: "local-thing@mine", enabled: false, installPath: "/x" }], available: [] },
      [],
    );
    const mp = res.marketplaces.find((m) => m.name === "mine")!;
    expect(mp.plugins[0]).toMatchObject({
      id: "local-thing@mine",
      name: "local-thing",
      installed: true,
      enabled: false,
      source: { type: "local", path: "/x" },
    });
  });

  it("populates installs and flags updateAvailable from catalog sha vs installed sha", () => {
    const list = {
      installed: [{ id: "p@m", enabled: true }],
      available: [
        { pluginId: "p@m", name: "p", marketplaceName: "m", source: {}, installCount: 2293 },
        { pluginId: "q@m", name: "q", marketplaceName: "m", source: {} },
      ],
    };
    const catalog = { "p@m": { sha: "NEWSHA", unique_installs: 9999 } };
    const res = mapClaudePluginList(list, [], catalog, { "p@m": "OLDSHA" });
    const plugins = res.marketplaces[0].plugins;
    const p = plugins.find((x) => x.id === "p@m")!;
    const q = plugins.find((x) => x.id === "q@m")!;
    expect(p.installs).toBe(2293); // installCount preferred over catalog unique_installs
    expect(p.updateAvailable).toBe(true);
    expect(q.installs).toBeUndefined();
    expect(q.updateAvailable).toBe(false); // not installed
  });

  it("does not flag updateAvailable when the catalog lacks a concrete sha", () => {
    const res = mapClaudePluginList(
      { installed: [{ id: "p@m", enabled: true }], available: [{ pluginId: "p@m", name: "p", source: {} }] },
      [],
      { "p@m": { source_sha: "DIFFERS" } }, // sha absent → unreliable, don't flag
      { "p@m": "INSTALLED" },
    );
    expect(res.marketplaces[0].plugins[0].updateAvailable).toBe(false);
  });
});

describe("claude.driver / mapClaudePluginDetail", () => {
  const catalog = {
    "frontend-design@claude-plugins-official": {
      plugin: "frontend-design",
      components: {
        commands: [],
        agents: [],
        skills: [{ name: "frontend-design", chars: { always_on: 236 } }],
        hooks: [],
        mcpServers: [{ name: "design-mcp" }],
      },
      marketplace_entry: {
        name: "frontend-design",
        description: "Create distinctive frontend interfaces.",
        author: { name: "Anthropic" },
        category: "development",
        homepage: "https://github.com/anthropics/x",
        source: "./plugins/frontend-design",
      },
    },
  };

  it("maps a catalog entry into a PluginDetail with components and installed state", () => {
    const detail = mapClaudePluginDetail(
      catalog,
      { "frontend-design@claude-plugins-official": true },
      "frontend-design",
      "/Users/me/.claude/plugins/marketplaces/claude-plugins-official",
    );

    expect(detail.marketplaceName).toBe("claude-plugins-official");
    expect(detail.description).toBe("Create distinctive frontend interfaces.");
    expect(detail.skills).toEqual([{ name: "frontend-design", enabled: true }]);
    expect(detail.mcpServers).toEqual(["design-mcp"]);
    expect(detail.apps).toEqual([]);
    expect(detail.summary).toMatchObject({
      id: "frontend-design@claude-plugins-official",
      name: "frontend-design",
      installed: true,
      enabled: true,
      installPolicy: "AVAILABLE",
    });
    expect(detail.summary.interface).toMatchObject({
      displayName: "frontend-design",
      developerName: "Anthropic",
      category: "development",
      websiteUrl: "https://github.com/anthropics/x",
    });
  });

  it("marks not-installed plugins and resolves the id by name fallback", () => {
    const detail = mapClaudePluginDetail(catalog, {}, "frontend-design", "");
    expect(detail.summary).toMatchObject({
      id: "frontend-design@claude-plugins-official",
      installed: false,
      enabled: false,
    });
  });

  it("degrades to a minimal detail when the catalog is empty", () => {
    const detail = mapClaudePluginDetail({}, {}, "ghost", "/m/some-market");
    expect(detail.summary.id).toBe("ghost@some-market");
    expect(detail.description).toBeNull();
    expect(detail.skills).toEqual([]);
    expect(detail.mcpServers).toEqual([]);
    expect(detail.summary.interface?.displayName).toBe("ghost");
  });
});

// ─────────────────────────────────────────────────────────────
// Background/foreground task mapping (system:task_* messages).
//
// Payloads mirror what the bundled Claude CLI actually emits: a `sleep`
// backgrounded into a local_bash task, and an Agent subagent task.
// ─────────────────────────────────────────────────────────────

describe("claude.driver / mapTaskMessage", () => {
  const TS = 1_700_000_000_000;

  function sys(msg: Partial<SDKSystemMessage>): SDKSystemMessage {
    return {
      type: "system",
      uuid: "u1",
      session_id: "s1",
      ...msg,
    } as SDKSystemMessage;
  }

  function newIndex(): ClaudeTaskIndex {
    return new Map();
  }

  it("maps task_started and records the tool_use_id anchor", () => {
    const index = newIndex();
    const event = mapTaskMessage(
      sys({
        subtype: "task_started",
        task_id: "bflwfagyw",
        tool_use_id: "toolu_bash",
        description: "sleep 45 && echo finished-ok",
        task_type: "local_bash",
      }),
      index,
      TS,
    );

    expect(event).toMatchObject({
      type: "task",
      phase: "started",
      status: "running",
      taskId: "bflwfagyw",
      toolCallId: "toolu_bash",
      description: "sleep 45 && echo finished-ok",
      taskType: "local_bash",
      ts: TS,
    });
    expect(index.get("bflwfagyw")?.toolUseId).toBe("toolu_bash");
  });

  it("maps task_progress with usage and last tool", () => {
    const index = newIndex();
    mapTaskMessage(
      sys({ subtype: "task_started", task_id: "t1", tool_use_id: "toolu_agent", subagent_type: "general-purpose" }),
      index,
      TS,
    );

    const event = mapTaskMessage(
      sys({
        subtype: "task_progress",
        task_id: "t1",
        tool_use_id: "toolu_agent",
        last_tool_name: "Bash",
        summary: "Counting files",
        usage: { total_tokens: 1200, tool_uses: 3, duration_ms: 4500 },
      }),
      index,
      TS,
    );

    expect(event).toMatchObject({
      phase: "progress",
      status: "running",
      lastToolName: "Bash",
      summary: "Counting files",
      subagentType: "general-purpose",
      usage: { totalTokens: 1200, toolUses: 3, durationMs: 4500 },
    });
  });

  it("resolves task_updated through the index — it carries no tool_use_id", () => {
    const index = newIndex();
    mapTaskMessage(
      sys({ subtype: "task_started", task_id: "t1", tool_use_id: "toolu_agent" }),
      index,
      TS,
    );

    const event = mapTaskMessage(
      sys({
        subtype: "task_updated",
        task_id: "t1",
        patch: { status: "completed", end_time: 1785499819327 },
      }),
      index,
      TS,
    );

    expect(event).toMatchObject({
      phase: "updated",
      status: "completed",
      toolCallId: "toolu_agent",
    });
  });

  it("maps task_notification to the terminal phase and keeps the output file", () => {
    const index = newIndex();
    mapTaskMessage(
      sys({ subtype: "task_started", task_id: "bflwfagyw", tool_use_id: "toolu_bash" }),
      index,
      TS,
    );

    const event = mapTaskMessage(
      sys({
        subtype: "task_notification",
        task_id: "bflwfagyw",
        tool_use_id: "toolu_bash",
        status: "completed",
        summary: "sleep 45 && echo finished-ok",
        output_file: "/tmp/claude-task-bflwfagyw.log",
      }),
      index,
      TS,
    );

    expect(event).toMatchObject({
      phase: "completed",
      status: "completed",
      outputFile: "/tmp/claude-task-bflwfagyw.log",
      toolCallId: "toolu_bash",
    });
    // Terminal: the anchor is released so a recycled id cannot reattach.
    expect(index.has("bflwfagyw")).toBe(false);
  });

  it("surfaces the summary as the error when a task fails", () => {
    const index = newIndex();
    const event = mapTaskMessage(
      sys({
        subtype: "task_notification",
        task_id: "t9",
        tool_use_id: "toolu_x",
        status: "failed",
        summary: "command exited 1",
      }),
      index,
      TS,
    );

    expect(event).toMatchObject({ phase: "completed", status: "failed", error: "command exited 1" });
  });

  it("returns null when the task has no known tool call anchor", () => {
    // task_updated for a task whose start was never seen (e.g. resumed session).
    const event = mapTaskMessage(
      sys({ subtype: "task_updated", task_id: "orphan", patch: { status: "running" } }),
      newIndex(),
      TS,
    );
    expect(event).toBeNull();
  });

  it("returns null without a task_id", () => {
    const event = mapTaskMessage(
      sys({ subtype: "task_started", tool_use_id: "toolu_bash" }),
      newIndex(),
      TS,
    );
    expect(event).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// MCP elicitation bridge. Without a handler the SDK auto-declines every
// request, so these cover the paths that make a request reach the user.
// ─────────────────────────────────────────────────────────────

describe("claude.driver / elicitation handler", () => {
  const FORM_REQUEST = {
    serverName: "linear",
    message: "Provide your workspace credentials",
    mode: "form" as const,
    requestedSchema: {
      properties: { apiKey: { type: "string" } },
      required: ["apiKey"],
    },
  };

  function opts() {
    return { signal: new AbortController().signal };
  }

  it("routes the request to the approval broker as an elicitation", async () => {
    const requestApproval = vi.fn().mockResolvedValue({
      requestId: "x",
      approved: true,
      answer: JSON.stringify({ apiKey: "sk-123" }),
    });
    const handler = createClaudeElicitationHandler({ runId: "run-1", requestApproval });

    await expect(handler(FORM_REQUEST, opts())).resolves.toEqual({
      action: "accept",
      content: { apiKey: "sk-123" },
    });
    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-1",
        kind: "elicitation",
        serverName: "linear",
        elicitationMode: "form",
        question: "Provide your workspace credentials",
        requestedSchema: FORM_REQUEST.requestedSchema,
      }),
    );
  });

  it("declines when the user dismisses", async () => {
    const handler = createClaudeElicitationHandler({
      runId: "run-1",
      requestApproval: vi.fn().mockResolvedValue({ requestId: "x", approved: false }),
    });
    await expect(handler(FORM_REQUEST, opts())).resolves.toEqual({ action: "decline" });
  });

  // A URL elicitation is a browser round-trip; there is no content to send back.
  it("accepts a url elicitation without content", async () => {
    const handler = createClaudeElicitationHandler({
      runId: "run-1",
      requestApproval: vi.fn().mockResolvedValue({ requestId: "x", approved: true }),
    });
    await expect(
      handler(
        { serverName: "notion", message: "Authenticate", mode: "url", url: "https://x.test" },
        opts(),
      ),
    ).resolves.toEqual({ action: "accept" });
  });

  // Sending content we know is malformed surfaces as an opaque server-side
  // validation error; declining names the real problem.
  it("declines a form accepted without usable content", async () => {
    const handler = createClaudeElicitationHandler({
      runId: "run-1",
      requestApproval: vi
        .fn()
        .mockResolvedValue({ requestId: "x", approved: true, answer: "not json" }),
    });
    await expect(handler(FORM_REQUEST, opts())).resolves.toEqual({ action: "decline" });
  });

  it("drops values MCP cannot express rather than sending them", async () => {
    const handler = createClaudeElicitationHandler({
      runId: "run-1",
      requestApproval: vi.fn().mockResolvedValue({
        requestId: "x",
        approved: true,
        answer: JSON.stringify({ keep: "a", n: 2, flag: true, tags: ["x"], nested: { a: 1 } }),
      }),
    });
    await expect(handler(FORM_REQUEST, opts())).resolves.toEqual({
      action: "accept",
      content: { keep: "a", n: 2, flag: true, tags: ["x"] },
    });
  });

  it("cancels immediately when the signal is already aborted", async () => {
    const requestApproval = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const handler = createClaudeElicitationHandler({ runId: "run-1", requestApproval });

    await expect(handler(FORM_REQUEST, { signal: controller.signal })).resolves.toEqual({
      action: "cancel",
    });
    expect(requestApproval).not.toHaveBeenCalled();
  });

  // A control stream can close while a dialog is parked; the broker entry has to
  // be released too or the renderer keeps a dialog nothing will ever answer.
  it("releases the broker entry when aborted mid-request", async () => {
    const controller = new AbortController();
    const cancelApproval = vi.fn();
    const handler = createClaudeElicitationHandler({
      runId: "run-1",
      requestApproval: () => new Promise(() => {}),
      cancelApproval,
    });

    const pending = handler(FORM_REQUEST, { signal: controller.signal });
    controller.abort();
    await expect(pending).resolves.toEqual({ action: "cancel" });
    expect(cancelApproval).toHaveBeenCalledTimes(1);
  });
});
