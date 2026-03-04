import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  blob,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";

/* -----------------------------
   ACCOUNTS / SETTINGS
------------------------------ */

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey().notNull().default("default"),
    displayName: text("display_name"),
    email: text("email"),
    company: text("company"),
    jobTitle: text("job_title"),
    timezone: text("timezone"),
    locale: text("locale"),
    website: text("website"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_accounts_email").on(t.email),
    index("idx_accounts_display_name").on(t.displayName),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey().notNull().default("default"),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),

  activeSpaceId: text("active_space_id").references(() => spaces.id, {
    onDelete: "set null",
  }),

  enableWorktrees: integer("enable_worktrees", { mode: "boolean" })
    .notNull()
    .default(true),

  showToolCalls: integer("show_tool_calls", { mode: "boolean" })
    .notNull()
    .default(true),

  preventSleepDuringRuns: integer("prevent_sleep_during_runs", { mode: "boolean" })
    .notNull()
    .default(false),

  notifyOnRunComplete: integer("notify_on_run_complete", { mode: "boolean" })
    .notNull()
    .default(true),

  notifyOnToolApproval: integer("notify_on_tool_approval", { mode: "boolean" })
    .notNull()
    .default(true),

  commitInstructions: text("commit_instructions").notNull().default(""),
  prInstructions: text("pr_instructions").notNull().default(""),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/* -----------------------------
   PROVIDERS (LLM / agent runtimes)
   - shared by chat_sessions (normal chat UI)
   - shared by runs (terminal/code-writing flow)
------------------------------ */

export const providers = sqliteTable(
  "providers",
  {
    id: text("id").primaryKey(), // "ollama" | "copilot_cli" | "claude_code" | ...
    kind: text("kind", { enum: ["llm_runtime", "agent_runtime"] }).notNull(),
    displayName: text("display_name").notNull(),
    isEnabled: integer("is_enabled", { mode: "boolean" })
      .notNull()
      .default(true),

    // e.g. { baseUrl, binaryPath, envVarHints, ... }
    config: text("config"), // JSON

    // e.g. { toolCalling: true, streaming: true, jsonSchema: true, ... }
    capabilities: text("capabilities"), // JSON

    defaultModel: text("default_model"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_providers_kind").on(t.kind),
    index("idx_providers_enabled").on(t.isEnabled),
    index("idx_providers_updated").on(t.updatedAt),
    check(
      "check_providers_config_json",
      sql`json_valid(${t.config}) OR ${t.config} IS NULL`,
    ),
    check(
      "check_providers_capabilities_json",
      sql`json_valid(${t.capabilities}) OR ${t.capabilities} IS NULL`,
    ),
  ],
);

/* -----------------------------
   PROJECTS (group workspaces by shared remote origin)
------------------------------ */

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rootPath: text("root_path").notNull(), // original clone/source repo path
    workspacesPath: text("workspaces_path"), // worktree directory for this project
    branches: text("branches"), // JSON array of branch names
    remoteOrigin: text("remote_origin").notNull(), // normalized origin URL
    defaultBranch: text("default_branch"),
    setupScript: text("setup_script"),
    runScript: text("run_script"),
    archiveScript: text("archive_script"),
    icon: text("icon"), // "icon:rocket", "emoji:🚀", or null
    commitInstructions: text("commit_instructions"),
    prInstructions: text("pr_instructions"),
    isArchived: integer("is_archived", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_projects_account_origin").on(t.accountId, t.remoteOrigin),
    index("idx_projects_account").on(t.accountId),
    index("idx_projects_remote_origin").on(t.remoteOrigin),
    index("idx_projects_updated").on(t.updatedAt),
    check(
      "check_projects_branches_json",
      sql`json_valid(${t.branches}) OR ${t.branches} IS NULL`,
    ),
  ],
);

/* -----------------------------
   WORKSPACES (local projects / repos)
------------------------------ */

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(), // uuid
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),

    name: text("name").notNull(),
    rootPath: text("root_path").notNull(), // local absolute path
    repoUrl: text("repo_url"),
    defaultBranch: text("default_branch"),
    metadata: text("metadata"), // JSON (optional)
    status: text("status", {
      enum: ["backlog", "todo", "in_progress", "in_review", "done", "canceled", "duplicate"],
    })
      .notNull()
      .default("todo"),
    isArchived: integer("is_archived", { mode: "boolean" })
      .notNull()
      .default(false),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_workspaces_account").on(t.accountId),
    index("idx_workspaces_project").on(t.projectId),
    uniqueIndex("uniq_workspaces_account_root").on(t.accountId, t.rootPath),
    index("idx_workspaces_status").on(t.status),
    index("idx_workspaces_updated").on(t.updatedAt),
    check(
      "check_workspaces_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   PROJECT RESOURCES (pivot table)
   Links projects to connection_resources
------------------------------ */

export const projectResources = sqliteTable(
  "project_resources",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => connectionResources.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_project_resources").on(t.projectId, t.resourceId),
    index("idx_project_resources_project").on(t.projectId),
    index("idx_project_resources_resource").on(t.resourceId),
  ],
);

/* -----------------------------
   RUNS (terminal/code-writing flow)
------------------------------ */

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(), // uuid
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),

    // optional: which space/profile initiated this run (tool policies etc.)
    spaceId: text("space_id").references(() => spaces.id, {
      onDelete: "set null",
    }),

    providerId: text("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "restrict" }),

    model: text("model"), // snapshot
    title: text("title"),
    goal: text("goal"), // user intent

    status: text("status", {
      enum: ["queued", "running", "succeeded", "failed", "canceled"],
    })
      .notNull()
      .default("queued"),

    // snapshots for reproducibility
    systemPrompt: text("system_prompt"),
    configSnapshot: text("config_snapshot"), // JSON (temp/top_p/max_tokens/etc)
    toolPolicySnapshot: text("tool_policy_snapshot"), // JSON (allow/deny, etc)

    startedAt: integer("started_at", { mode: "timestamp" }),
    endedAt: integer("ended_at", { mode: "timestamp" }),
    lastError: text("last_error"),
    stopReason: text("stop_reason"),
    sessionId: text("session_id"),
    isArchived: integer("is_archived", { mode: "boolean" })
      .notNull()
      .default(false),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_runs_account_created").on(t.accountId, t.createdAt),
    index("idx_runs_account_status").on(t.accountId, t.status),
    index("idx_runs_provider").on(t.providerId),
    index("idx_runs_workspace").on(t.workspaceId),
    index("idx_runs_space").on(t.spaceId),
    index("idx_runs_updated").on(t.updatedAt),
    check(
      "check_runs_config_snapshot_json",
      sql`json_valid(${t.configSnapshot}) OR ${t.configSnapshot} IS NULL`,
    ),
    check(
      "check_runs_tool_policy_snapshot_json",
      sql`json_valid(${t.toolPolicySnapshot}) OR ${t.toolPolicySnapshot} IS NULL`,
    ),
  ],
);

/* -----------------------------
   RUN USAGE (cost, duration, tokens per run)
------------------------------ */

export const runUsage = sqliteTable(
  "run_usage",
  {
    runId: text("run_id")
      .primaryKey()
      .references(() => runs.id, { onDelete: "cascade" }),
    totalCostMicros: integer("total_cost_micros"), // USD * 1_000_000 (avoids float)
    durationMs: integer("duration_ms"),
    numTurns: integer("num_turns"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    providerId: text("provider_id").references(() => providers.id, {
      onDelete: "set null",
    }),
    model: text("model"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_run_usage_provider").on(t.providerId),
    index("idx_run_usage_model").on(t.model),
    index("idx_run_usage_created").on(t.createdAt),
  ],
);

/* -----------------------------
   RUN TURNS (per-turn tracking with usage)
------------------------------ */

export const runTurns = sqliteTable(
  "run_turns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    turnIndex: integer("turn_index").notNull(),
    promptContent: text("prompt_content"),
    responseContent: text("response_content"),
    startedAt: integer("started_at", { mode: "timestamp" }),
    endedAt: integer("ended_at", { mode: "timestamp" }),
    elapsedMs: integer("elapsed_ms"),
    status: text("status", { enum: ["active", "completed"] })
      .notNull()
      .default("active"),
    // Usage fields
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheWriteTokens: integer("cache_write_tokens"),
    costMicros: integer("cost_micros"), // USD * 1_000_000
    model: text("model"),
    modelUsage: text("model_usage"), // JSON: Record<modelName, { costUSD, inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens }>
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_run_turns_run").on(t.runId),
    index("idx_run_turns_run_index").on(t.runId, t.turnIndex),
    check(
      "check_run_turns_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   RUN CONTEXT (what the run looked at / was given)
------------------------------ */

export const runContext = sqliteTable(
  "run_context",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),

    kind: text("kind", {
      enum: ["file", "selection", "diff", "git", "terminal", "env", "note"],
    }).notNull(),

    // path / commit / command / etc.
    ref: text("ref"),

    // small context inline; if large, store as entity + chunks and link via entityId
    content: text("content"),
    entityId: text("entity_id").references(() => entities.id, {
      onDelete: "set null",
    }),

    contentHash: text("content_hash"), // sha256/xxhash as string
    metadata: text("metadata"), // JSON (line ranges, mime, size, etc.)

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_run_context_run").on(t.runId),
    index("idx_run_context_kind").on(t.kind),
    index("idx_run_context_entity").on(t.entityId),
    index("idx_run_context_hash").on(t.contentHash),
    check(
      "check_run_context_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   RUN ARTIFACTS (patches, logs, files, reports)
------------------------------ */

export const runArtifacts = sqliteTable(
  "run_artifacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),

    kind: text("kind", {
      enum: ["patch", "file", "log", "report", "command_result", "result"],
    }).notNull(),

    // for files/patches
    path: text("path"),
    content: text("content"),
    blobData: blob("blob_data"),

    // or store big content as entity
    entityId: text("entity_id").references(() => entities.id, {
      onDelete: "set null",
    }),

    contentHash: text("content_hash"),
    metadata: text("metadata"), // JSON (exitCode, bytes, language, etc.)

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_run_artifacts_run").on(t.runId),
    index("idx_run_artifacts_kind").on(t.kind),
    index("idx_run_artifacts_path").on(t.path),
    index("idx_run_artifacts_entity").on(t.entityId),
    index("idx_run_artifacts_hash").on(t.contentHash),
    check(
      "check_run_artifacts_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);
/* -----------------------------
   WORKSPACE DIFFS (git diff captured after a run, persisted per workspace)
------------------------------ */

export const workspaceDiffs = sqliteTable(
  "workspace_diffs",
  {
    id: text("id").primaryKey(), // uuid
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),

    baseRef: text("base_ref"), // HEAD sha captured at run start
    diffText: text("diff_text").notNull(), // unified diff patch
    filesJson: text("files_json"), // JSON array of changed file paths
    statsJson: text("stats_json"), // JSON object { shortstat, files }

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_workspace_diffs_workspace").on(t.workspaceId),
    index("idx_workspace_diffs_created").on(t.createdAt),
    check(
      "check_workspace_diffs_files_json",
      sql`json_valid(${t.filesJson}) OR ${t.filesJson} IS NULL`,
    ),
    check(
      "check_workspace_diffs_stats_json",
      sql`json_valid(${t.statsJson}) OR ${t.statsJson} IS NULL`,
    ),
  ],
);

/* -----------------------------
   REVIEWS (workspace-level review records)
------------------------------ */

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    summary: text("summary"),
    status: text("status", {
      enum: ["open", "in_review", "approved", "rejected"],
    })
      .notNull()
      .default("open"),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_reviews_workspace").on(t.workspaceId),
    index("idx_reviews_status").on(t.status),
    index("idx_reviews_updated").on(t.updatedAt),
    check(
      "check_reviews_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   REVIEW FINDINGS (file-level review results)
------------------------------ */

export const reviewFindings = sqliteTable(
  "review_findings",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    severity: text("severity", {
      enum: ["critical", "warning", "info"],
    }).notNull(),
    file: text("file").notNull(),
    lineStart: integer("line_start"),
    lineEnd: integer("line_end"),
    message: text("message").notNull(),
    reason: text("reason").notNull(),
    suggestion: text("suggestion"),
    validated: integer("validated", { mode: "boolean" })
      .notNull()
      .default(false),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_review_findings_review").on(t.reviewId),
    index("idx_review_findings_severity").on(t.severity),
    check(
      "check_review_findings_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   WORKSPACE ACTIVITY (unified activity timeline)
------------------------------ */

export const workspaceActivity = sqliteTable(
  "workspace_activity",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["diff", "review", "finding", "commit", "pr"],
    }).notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    metadata: text("metadata"),
    refId: text("ref_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_workspace_activity_workspace").on(t.workspaceId),
    index("idx_workspace_activity_type").on(t.type),
    index("idx_workspace_activity_created").on(t.createdAt),
    check(
      "check_workspace_activity_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   RUN COMMANDS (terminal commands + exit codes)
------------------------------ */

export const runCommands = sqliteTable(
  "run_commands",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),

    cwd: text("cwd"),
    command: text("command").notNull(), // raw command string
    envKeys: text("env_keys"), // JSON array of keys (no secrets)

    status: text("status", {
      enum: ["queued", "running", "done", "error", "canceled"],
    })
      .notNull()
      .default("queued"),

    startedAt: integer("started_at", { mode: "timestamp" }),
    endedAt: integer("ended_at", { mode: "timestamp" }),
    exitCode: integer("exit_code"),

    // keep short outputs here; big outputs -> runArtifacts(kind=log/command_result)
    stdout: text("stdout"),
    stderr: text("stderr"),

    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_run_commands_run").on(t.runId),
    index("idx_run_commands_status").on(t.status),
    index("idx_run_commands_created").on(t.createdAt),
    check(
      "check_run_commands_env_keys_json",
      sql`json_valid(${t.envKeys}) OR ${t.envKeys} IS NULL`,
    ),
    check(
      "check_run_commands_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   MCP SERVERS (optional, but useful if you discover tools dynamically)
------------------------------ */

export const mcpServers = sqliteTable(
  "mcp_servers",
  {
    id: text("id").primaryKey(), // uuid or "local"
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    transport: text("transport", { enum: ["stdio", "http", "ws"] }).notNull(),
    endpoint: text("endpoint"), // url or command (depends on transport)
    status: text("status", { enum: ["active", "disabled", "error"] })
      .notNull()
      .default("active"),

    metadata: text("metadata"), // JSON (auth hints, headers, etc.)
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_mcp_servers_account").on(t.accountId),
    index("idx_mcp_servers_status").on(t.status),
    check(
      "check_mcp_servers_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   TOOLS REGISTRY (local + mcp + provider builtins)
------------------------------ */

export const tools = sqliteTable(
  "tools",
  {
    id: text("id").primaryKey(), // stable id you control
    source: text("source", {
      enum: ["local", "mcp", "provider_builtin"],
    }).notNull(),

    // display + invocation
    name: text("name").notNull(),
    description: text("description"),
    version: text("version"),
    isEnabled: integer("is_enabled", { mode: "boolean" })
      .notNull()
      .default(true),

    // JSON Schema
    schema: text("schema"), // JSON

    // if MCP-sourced
    mcpServerId: text("mcp_server_id").references(() => mcpServers.id, {
      onDelete: "set null",
    }),

    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_tools_source_name").on(t.source, t.name),
    index("idx_tools_source").on(t.source),
    index("idx_tools_enabled").on(t.isEnabled),
    index("idx_tools_mcp_server").on(t.mcpServerId),
    check(
      "check_tools_schema_json",
      sql`json_valid(${t.schema}) OR ${t.schema} IS NULL`,
    ),
    check(
      "check_tools_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   SPACE TOOL PERMISSIONS (simple + powerful)
------------------------------ */

export const spaceToolPermissions = sqliteTable(
  "space_tool_permissions",
  {
    spaceId: text("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    toolId: text("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),

    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),

    // e.g. { fs: { allowWrite: false, allowedPaths: [...] }, network: {...}, limits: {...} }
    policy: text("policy"), // JSON

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_space_tool").on(t.spaceId, t.toolId),
    index("idx_space_tool_tool").on(t.toolId),
    check(
      "check_space_tool_policy_json",
      sql`json_valid(${t.policy}) OR ${t.policy} IS NULL`,
    ),
  ],
);

/* -----------------------------
   TOOL CALLS (invocation log)
   - can be used by BOTH chat + runs
   - link to runId when terminal/code-writing
   - link to chatMessages via messageId if you want later (optional)
------------------------------ */

// tool_calls
export const toolCalls = sqliteTable(
  "tool_calls",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    runId: text("run_id").references(() => runs.id, { onDelete: "cascade" }),

    providerId: text("provider_id").references(() => providers.id, {
      onDelete: "set null",
    }),

    toolId: text("tool_id").references(() => tools.id, {
      onDelete: "set null",
    }),

    // ✅ NEW: provider tool call correlation id (toolu_..., call_id, etc.)
    toolCallId: text("tool_call_id"),

    // ✅ NEW (optional): nested/child tool call linkage
    parentToolCallId: text("parent_tool_call_id"),

    toolName: text("tool_name").notNull(),

    status: text("status", {
      enum: ["queued", "running", "done", "error", "canceled"],
    })
      .notNull()
      .default("queued"),

    input: text("input"),
    output: text("output"),
    error: text("error"),

    startedAt: integer("started_at", { mode: "timestamp" }),
    endedAt: integer("ended_at", { mode: "timestamp" }),

    latencyMs: integer("latency_ms"),
    costMicros: integer("cost_micros"),

    metadata: text("metadata"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_tool_calls_account_created").on(t.accountId, t.createdAt),
    index("idx_tool_calls_run").on(t.runId),
    index("idx_tool_calls_provider").on(t.providerId),
    index("idx_tool_calls_tool").on(t.toolId),
    index("idx_tool_calls_status").on(t.status),

    // ✅ NEW: fast lookup for end event updates
    index("idx_tool_calls_run_toolcallid").on(t.runId, t.toolCallId),

    check(
      "check_tool_calls_input_json",
      sql`json_valid(${t.input}) OR ${t.input} IS NULL`,
    ),
    check(
      "check_tool_calls_output_json",
      sql`json_valid(${t.output}) OR ${t.output} IS NULL`,
    ),
    check(
      "check_tool_calls_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);
/* -----------------------------
   CONNECTIONS / TOKENS / SYNC
------------------------------ */

export const connections = sqliteTable(
  "connections",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(), // github|linear|notion|gmail|rss|...
    type: text("type").notNull(), // oauth|api_key|local|...
    displayName: text("display_name"),
    status: text("status", {
      enum: ["active", "revoked", "error", "disabled"],
    })
      .notNull()
      .default("active"),
    scopes: text("scopes"), // JSON
    metadata: text("metadata"), // JSON
    connectedAt: integer("connected_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_connections_provider").on(t.provider),
    index("idx_connections_status").on(t.status),
    index("idx_connections_connected_at").on(t.connectedAt),
    index("idx_connections_updated_at").on(t.updatedAt),
    check(
      "check_connections_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
    check(
      "check_connections_scopes_json",
      sql`json_valid(${t.scopes}) OR ${t.scopes} IS NULL`,
    ),
  ],
);

export const connectionTokens = sqliteTable(
  "connection_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    accessTokenEnc: blob("access_token_enc"),
    refreshTokenEnc: blob("refresh_token_enc"),
    tokenType: text("token_type"),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    tokenHash: blob("token_hash"),
    keyVersion: integer("key_version").notNull().default(1),
    isCurrent: integer("is_current", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_ct_conn").on(t.connectionId),
    index("idx_ct_current").on(t.isCurrent),
    index("idx_ct_expires").on(t.expiresAt),
    index("idx_ct_created_at").on(t.createdAt),
    index("idx_ct_token_hash").on(t.tokenHash),
    uniqueIndex("uniq_ct_conn_current")
      .on(t.connectionId)
      .where(sql`${t.isCurrent} = 1`),
  ],
);

export const connectionSyncState = sqliteTable(
  "connection_sync_state",
  {
    connectionId: text("connection_id")
      .primaryKey()
      .references(() => connections.id, { onDelete: "cascade" }),
    cursor: text("cursor"), // JSON
    lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
    lastSuccessAt: integer("last_success_at", { mode: "timestamp" }),
    lastErrorAt: integer("last_error_at", { mode: "timestamp" }),
    lastError: text("last_error"),
    backoffUntil: integer("backoff_until", { mode: "timestamp" }),
    etag: text("etag"),
  },
  (t) => [
    index("idx_sync_state_last_sync").on(t.lastSyncAt),
    index("idx_sync_state_last_success").on(t.lastSuccessAt),
    index("idx_sync_state_backoff_until").on(t.backoffUntil),
    check(
      "check_sync_cursor_json",
      sql`json_valid(${t.cursor}) OR ${t.cursor} IS NULL`,
    ),
  ],
);

export const connectionResources = sqliteTable(
  "connection_resources",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(), // repo full_name, notion db id, ...
    kind: text("kind").notNull(), // github_repo|notion_db|rss_feed|...
    name: text("name"),
    url: text("url"),
    selected: integer("selected", { mode: "boolean" }).notNull().default(true),
    metadata: text("metadata"), // JSON
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
    lastIngestAt: integer("last_ingest_at", { mode: "timestamp" }),
  },
  (t) => [
    uniqueIndex("uniq_resources_conn_ext").on(t.connectionId, t.externalId),
    index("idx_resources_kind").on(t.kind),
    index("idx_resources_selected").on(t.selected),
    index("idx_resources_conn").on(t.connectionId),
    index("idx_resources_last_ingest").on(t.lastIngestAt),
    index("idx_resources_last_seen").on(t.lastSeenAt),
    check(
      "check_resources_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   SPACES / APP STATE
------------------------------ */

export const appStates = sqliteTable(
  "app_states",
  {
    id: text("id").primaryKey(), // "github" | "notion" | "raindrop" | ...
    isConnected: integer("is_connected", { mode: "boolean" })
      .notNull()
      .default(false),
    connectionId: text("connection_id").references(() => connections.id, {
      onDelete: "set null",
    }),
    displayName: text("display_name"),
    category: text("category"),
    iconPath: text("icon_path"),
    sortOrder: integer("sort_order").notNull().default(0),
    enabledFeatures: text("enabled_features"), // JSON
    config: text("config"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },

  (t) => [
    index("idx_app_states_connected").on(t.isConnected),
    index("idx_app_states_sort").on(t.sortOrder),
    index("idx_app_states_updated_at").on(t.updatedAt),
    index("idx_app_states_created_at").on(t.createdAt),
    check(
      "check_enabled_features_json",
      sql`json_valid(${t.enabledFeatures}) OR ${t.enabledFeatures} IS NULL`,
    ),
    check(
      "check_config_json",
      sql`json_valid(${t.config}) OR ${t.config} IS NULL`,
    ),
  ],
);

export const spaces = sqliteTable(
  "spaces",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    systemPrompt: text("system_prompt"),
    model: text("model"),
    icon: text("icon"),
    themeConfig: text("theme_config"), // JSON
    uiConfig: text("ui_config"), // JSON
    isArchived: integer("is_archived", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_spaces_account_slug").on(t.accountId, t.slug),
    uniqueIndex("uniq_spaces_account_name").on(t.accountId, t.name),
    index("idx_spaces_account").on(t.accountId),
    index("idx_spaces_sort").on(t.sortOrder),
    index("idx_spaces_updated").on(t.updatedAt),
    check(
      "check_spaces_theme_json",
      sql`json_valid(${t.themeConfig}) OR ${t.themeConfig} IS NULL`,
    ),
    check(
      "check_spaces_ui_json",
      sql`json_valid(${t.uiConfig}) OR ${t.uiConfig} IS NULL`,
    ),
  ],
);

export const spaceConnections = sqliteTable(
  "space_connections",
  {
    spaceId: text("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_space_conn").on(t.spaceId, t.connectionId),
    index("idx_space_conn_conn").on(t.connectionId),
  ],
);

export const spaceResources = sqliteTable(
  "space_resources",
  {
    spaceId: text("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => connectionResources.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_space_resource").on(t.spaceId, t.resourceId),
    index("idx_space_resource_resource").on(t.resourceId),
    index("idx_space_resource_sort").on(t.spaceId, t.sortOrder),
    check(
      "check_space_resources_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

export const spaceAppOverrides = sqliteTable(
  "space_app_overrides",
  {
    spaceId: text("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    appId: text("app_id")
      .notNull()
      .references(() => appStates.id, { onDelete: "cascade" }),

    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),

    enabledFeatures: text("enabled_features"), // JSON override
    config: text("config"), // JSON override

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_space_app").on(t.spaceId, t.appId),
    check(
      "check_enabled_features_json",
      sql`json_valid(${t.enabledFeatures}) OR ${t.enabledFeatures} IS NULL`,
    ),
    check(
      "check_config_json",
      sql`json_valid(${t.config}) OR ${t.config} IS NULL`,
    ),
  ],
);

/* -----------------------------
   UNIFIED CANONICAL CONTENT: ENTITIES
------------------------------ */

export const entities = sqliteTable(
  "entities",
  {
    id: text("id").primaryKey(), // uuid
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    // What is it?
    kind: text("kind").notNull(),
    // examples: task|issue|doc|bookmark|rss_article|podcast_episode|playlist|email|video|hn_item

    // Source / mapping
    connectionId: text("connection_id").references(() => connections.id, {
      onDelete: "set null",
    }),
    resourceId: text("resource_id").references(() => connectionResources.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id"), // provider id
    url: text("url"),

    // Common searchable content
    title: text("title"),
    body: text("body"), // markdown/plain (long)
    summary: text("summary"), // short (for lists/LLM)
    metadata: text("metadata"), // JSON provider-specific

    // Timestamps
    occurredAt: integer("occurred_at", { mode: "timestamp" }), // publishedAt / happenedAt
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp" }),
    etag: text("etag"),
    isDeleted: integer("is_deleted", { mode: "boolean" })
      .notNull()
      .default(false),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_entities_source").on(
      t.connectionId,
      t.kind,
      t.externalId,
    ),
    index("idx_entities_account_kind").on(t.accountId, t.kind),
    index("idx_entities_conn").on(t.connectionId),
    index("idx_entities_resource").on(t.resourceId),
    index("idx_entities_occurred").on(t.occurredAt),
    index("idx_entities_updated").on(t.updatedAt),
    check(
      "check_entities_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

export const entityChunks = sqliteTable(
  "entity_chunks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_entity_chunk").on(t.entityId, t.chunkIndex),
    index("idx_entity_chunks_entity").on(t.entityId),
  ],
);

export const vecEntityChunks = sqliteTable("vec_entity_chunks", {
  rowid: integer("rowid").primaryKey(),
  embedding: blob("embedding"),
});

export const vecEntityChunkMap = sqliteTable(
  "vec_entity_chunk_map",
  {
    vecRowid: integer("vec_rowid")
      .primaryKey()
      .references(() => vecEntityChunks.rowid, { onDelete: "cascade" }),
    chunkId: integer("chunk_id")
      .notNull()
      .unique()
      .references(() => entityChunks.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_vec_entity_chunk_map_chunk").on(t.chunkId)],
);

/* -----------------------------
   ACTIONABLE DOMAIN TABLES
   - keep canonical text in entities
   - keep queryable state here
------------------------------ */

export const tasks = sqliteTable(
  "tasks",
  {
    entityId: text("entity_id")
      .primaryKey()
      .references(() => entities.id, { onDelete: "cascade" }),

    status: text("status", { enum: ["todo", "doing", "done", "canceled"] })
      .notNull()
      .default("todo"),
    dueAt: integer("due_at", { mode: "timestamp" }),
    priority: integer("priority").notNull().default(0),
    labels: text("labels"), // JSON array
  },
  (t) => [
    index("idx_tasks_status").on(t.status),
    index("idx_tasks_due").on(t.dueAt),
    check(
      "check_tasks_labels_json",
      sql`json_valid(${t.labels}) OR ${t.labels} IS NULL`,
    ),
  ],
);

export const issues = sqliteTable(
  "issues",
  {
    entityId: text("entity_id")
      .primaryKey()
      .references(() => entities.id, { onDelete: "cascade" }),

    provider: text("provider").notNull(), // github|linear|jira
    state: text("state").notNull(), // open|closed|in_progress|...
    number: integer("number"), // github issue no
    repo: text("repo"), // owner/name or project key
    assignee: text("assignee"),
    labels: text("labels"), // JSON array
    closedAt: integer("closed_at", { mode: "timestamp" }),
    priority: integer("priority").notNull().default(0),
  },
  (t) => [
    index("idx_issues_provider_state").on(t.provider, t.state),
    index("idx_issues_repo").on(t.repo),
    check(
      "check_issues_labels_json",
      sql`json_valid(${t.labels}) OR ${t.labels} IS NULL`,
    ),
  ],
);

/* Optional: playlist membership if you need local ordering/queue */
export const playlistItems = sqliteTable(
  "playlist_items",
  {
    playlistEntityId: text("playlist_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    itemEntityId: text("item_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    metadata: text("metadata"), // JSON
  },
  (t) => [
    uniqueIndex("uniq_playlist_item").on(t.playlistEntityId, t.itemEntityId),
    index("idx_playlist_items_order").on(t.playlistEntityId, t.position),
    check(
      "check_playlist_items_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   OUTBOX: tool actions (offline-first retries)
------------------------------ */

export const outbox = sqliteTable(
  "outbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    entityId: text("entity_id").references(() => entities.id, {
      onDelete: "set null",
    }),
    connectionId: text("connection_id").references(() => connections.id, {
      onDelete: "cascade",
    }),

    actionType: text("action_type").notNull(), // 'github.issue.update'|'linear.issue.create'...
    payload: text("payload").notNull(), // JSON
    status: text("status", { enum: ["queued", "running", "done", "error"] })
      .notNull()
      .default("queued"),
    attempts: integer("attempts").notNull().default(0),
    nextRunAt: integer("next_run_at", { mode: "timestamp" }),
    lastError: text("last_error"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_outbox_status_next").on(t.status, t.nextRunAt),
    index("idx_outbox_account").on(t.accountId),
    check("check_outbox_payload_json", sql`json_valid(${t.payload})`),
  ],
);

/* -----------------------------
   FEED = EVENT LOG (timeline + retrieval trigger)
------------------------------ */

export const feedItems = sqliteTable(
  "feed_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    connectionId: text("connection_id").references(() => connections.id, {
      onDelete: "set null",
    }),
    resourceId: text("resource_id").references(() => connectionResources.id, {
      onDelete: "set null",
    }),

    // which entity this event is about (optional but strongly recommended)
    entityId: text("entity_id").references(() => entities.id, {
      onDelete: "set null",
    }),

    // 'entity.created'|'entity.updated'|'task.completed'|'sync.error'...
    eventType: text("event_type").notNull(),

    // for UI list grouping/filter
    itemType: text("item_type"), // task|issue|doc|rss_article|...
    title: text("title").notNull(),
    summary: text("summary"), // short textual context (LLM-friendly)
    url: text("url"),

    // state snapshot at that time (JSON)
    snapshot: text("snapshot"), // JSON
    metadata: text("metadata"), // JSON

    // event time (remote or local)
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    // embeddings
    embedding: blob("embedding"),
  },
  (t) => [
    index("idx_feed_account_time").on(t.accountId, t.occurredAt),
    index("idx_feed_entity_time").on(t.entityId, t.occurredAt),
    index("idx_feed_conn_time").on(t.connectionId, t.occurredAt),
    index("idx_feed_event_time").on(t.eventType, t.occurredAt),
    index("idx_feed_item_type_time").on(t.itemType, t.occurredAt),
    check(
      "check_feed_snapshot_json",
      sql`json_valid(${t.snapshot}) OR ${t.snapshot} IS NULL`,
    ),
    check(
      "check_feed_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`,
    ),
  ],
);

/* -----------------------------
   DOCUMENT REVISIONS (for journal history)
------------------------------ */

export const documentRevisions = sqliteTable(
  "document_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    title: text("title"),
    body: text("body"),
    wordCount: integer("word_count"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_doc_revisions_entity").on(t.entityId),
    index("idx_doc_revisions_created").on(t.createdAt),
  ],
);

/* -----------------------------
   CHAT 
------------------------------ */

export const chatSessions = sqliteTable(
  "chat_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title"),
    initialQuery: text("initial_query"),

    // NEW: default runtime for this session
    providerId: text("provider_id").references(() => providers.id, {
      onDelete: "set null",
    }),

    // keep model as session default (optional)
    model: text("model"),

    spaceId: text("space_id").references(() => spaces.id, {
      onDelete: "set null",
    }),
    systemPromptSnapshot: text("system_prompt_snapshot"),

    // NEW: optional provider config snapshot (for reproducibility)
    providerConfigSnapshot: text("provider_config_snapshot"), // JSON

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_chat_sessions_updated_at").on(t.updatedAt),
    index("idx_chat_sessions_created_at").on(t.createdAt),
    index("idx_chat_sessions_space").on(t.spaceId),

    // NEW indexes
    index("idx_chat_sessions_provider").on(t.providerId),
    index("idx_chat_sessions_model").on(t.model),

    check(
      "check_chat_sessions_provider_config_json",
      sql`json_valid(${t.providerConfigSnapshot}) OR ${t.providerConfigSnapshot} IS NULL`,
    ),
  ],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),

    role: text("role", {
      enum: ["system", "user", "assistant", "tool"],
    }).notNull(),
    content: text("content").notNull(),

    // NEW: per-message runtime overrides (optional)
    providerId: text("provider_id").references(() => providers.id, {
      onDelete: "set null",
    }),
    model: text("model"),

    // NEW: observability (optional but super useful)
    traceId: text("trace_id"),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),

    // NEW: if this assistant message produced tool calls, you can link later
    // (optional; you can also do it via tool_calls.chat_message_id)
    toolCallGroupId: text("tool_call_group_id"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_chat_messages_session").on(t.sessionId),

    // NEW indexes
    index("idx_chat_messages_provider").on(t.providerId),
    index("idx_chat_messages_model").on(t.model),
    index("idx_chat_messages_trace").on(t.traceId),
  ],
);
