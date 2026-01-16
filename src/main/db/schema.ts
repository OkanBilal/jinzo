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
  ]
);

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey().notNull().default("default"),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),

  activeMoodId: text("active_mood_id").references(() => moods.id, {
    onDelete: "set null",
  }),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});


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
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`
    ),
    check(
      "check_connections_scopes_json",
      sql`json_valid(${t.scopes}) OR ${t.scopes} IS NULL`
    ),
  ]
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
  ]
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
      sql`json_valid(${t.cursor}) OR ${t.cursor} IS NULL`
    ),
  ]
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
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`
    ),
  ]
);

/* -----------------------------
   MOODS / APP STATE
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
    iconPath: text("icon_path"),
    highlighted: integer("highlighted", { mode: "boolean" })
      .notNull()
      .default(false),
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
      sql`json_valid(${t.enabledFeatures}) OR ${t.enabledFeatures} IS NULL`
    ),
    check(
      "check_config_json",
      sql`json_valid(${t.config}) OR ${t.config} IS NULL`
    ),
  ]
);


export const moods = sqliteTable(
  "moods",
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
    uniqueIndex("uniq_moods_account_slug").on(t.accountId, t.slug),
    uniqueIndex("uniq_moods_account_name").on(t.accountId, t.name),
    index("idx_moods_account").on(t.accountId),
    index("idx_moods_sort").on(t.sortOrder),
    index("idx_moods_updated").on(t.updatedAt),
    check(
      "check_moods_theme_json",
      sql`json_valid(${t.themeConfig}) OR ${t.themeConfig} IS NULL`
    ),
    check(
      "check_moods_ui_json",
      sql`json_valid(${t.uiConfig}) OR ${t.uiConfig} IS NULL`
    ),
  ]
);

export const moodConnections = sqliteTable(
  "mood_connections",
  {
    moodId: text("mood_id")
      .notNull()
      .references(() => moods.id, { onDelete: "cascade" }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_mood_conn").on(t.moodId, t.connectionId),
    index("idx_mood_conn_conn").on(t.connectionId),
  ]
);

export const moodResources = sqliteTable(
  "mood_resources",
  {
    moodId: text("mood_id")
      .notNull()
      .references(() => moods.id, { onDelete: "cascade" }),
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
    uniqueIndex("uniq_mood_resource").on(t.moodId, t.resourceId),
    index("idx_mood_resource_resource").on(t.resourceId),
    index("idx_mood_resource_sort").on(t.moodId, t.sortOrder),
    check(
      "check_mood_resources_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`
    ),
  ]
);

export const moodAppOverrides = sqliteTable(
  "mood_app_overrides",
  {
    moodId: text("mood_id")
      .notNull()
      .references(() => moods.id, { onDelete: "cascade" }),
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
    uniqueIndex("uniq_mood_app").on(t.moodId, t.appId),
    check(
      "check_enabled_features_json",
      sql`json_valid(${t.enabledFeatures}) OR ${t.enabledFeatures} IS NULL`
    ),
    check(
      "check_config_json",
      sql`json_valid(${t.config}) OR ${t.config} IS NULL`
    ),
  ]
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
    isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_entities_source")
      .on(t.connectionId, t.kind, t.externalId),
    index("idx_entities_account_kind").on(t.accountId, t.kind),
    index("idx_entities_conn").on(t.connectionId),
    index("idx_entities_resource").on(t.resourceId),
    index("idx_entities_occurred").on(t.occurredAt),
    index("idx_entities_updated").on(t.updatedAt),
    check(
      "check_entities_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`
    ),
  ]
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
  ]
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
  (t) => [index("idx_vec_entity_chunk_map_chunk").on(t.chunkId)]
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
      sql`json_valid(${t.labels}) OR ${t.labels} IS NULL`
    ),
  ]
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
      sql`json_valid(${t.labels}) OR ${t.labels} IS NULL`
    ),
  ]
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
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`
    ),
  ]
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
  ]
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
      sql`json_valid(${t.snapshot}) OR ${t.snapshot} IS NULL`
    ),
    check(
      "check_feed_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`
    ),
  ]
);



/* -----------------------------
   CHAT (as you had)
------------------------------ */

export const chatSessions = sqliteTable(
  "chat_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title"),
    initialQuery: text("initial_query"),
    model: text("model"),
    moodId: text("mood_id").references(() => moods.id, {
      onDelete: "set null",
    }),
    systemPromptSnapshot: text("system_prompt_snapshot"),
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
    index("idx_chat_sessions_mood").on(t.moodId),
  ]
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["system", "user", "assistant", "tool"] })
      .notNull(),
    content: text("content").notNull(),
    model: text("model"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_chat_messages_session").on(t.sessionId)]
);
