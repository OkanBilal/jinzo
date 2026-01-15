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

export const connections = sqliteTable(
  "connections",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    type: text("type").notNull(),
    displayName: text("display_name"),
    status: text("status", {
      enum: ["active", "revoked", "error", "disabled"],
    })
      .notNull()
      .default("active"),
    scopes: text("scopes"), // JSON/CSV
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
      "check_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`
    ),
    check(
      "check_scopes_json",
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
    tokenHash: blob("token_hash"), // SHA-256(plain) result
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
    index("idx_ct_expires_current").on(t.expiresAt, t.isCurrent),
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
    cursor: text("cursor"), // JSON: since, pageToken, etag...
    lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
    lastSuccessAt: integer("last_success_at", { mode: "timestamp" }),
    lastErrorAt: integer("last_error_at", { mode: "timestamp" }),
    lastError: text("last_error"),
    backoffUntil: integer("backoff_until", { mode: "timestamp" }),
    etag: text("etag"), // HTTP caching
  },
  (t) => [
    index("idx_sync_state_last_sync").on(t.lastSyncAt),
    index("idx_sync_state_last_success").on(t.lastSuccessAt),
    index("idx_sync_state_backoff_until").on(t.backoffUntil),
    check(
      "check_cursor_json",
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
    externalId: text("external_id").notNull(), // Notion db id, GitHub repo full_name, vb.
    kind: text("kind").notNull(), // 'notion_database'|'github_repo'|'calendar'...
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
    index("idx_resources_last_seen_selected").on(t.lastSeenAt, t.selected),
    check(
      "check_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`
    ),
  ]
);

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
    themeConfig: text("theme_config"), // JSON (colors, typography, etc.)
    uiConfig: text("ui_config"), // JSON (layout, tabs, shortcuts, etc.)
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
      "check_theme_json",
      sql`json_valid(${t.themeConfig}) OR ${t.themeConfig} IS NULL`
    ),
    check(
      "check_ui_json",
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
    metadata: text("metadata"), // JSON: mood-specific notes, tags, etc.

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uniq_mood_resource").on(t.moodId, t.resourceId),
    index("idx_mood_resource_resource").on(t.resourceId),
    index("idx_mood_resource_sort").on(t.moodId, t.sortOrder),
    check(
      "check_metadata_json",
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

export const chatSessions = sqliteTable(
  "ChatSession",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title"),
    initialQuery: text("initialQuery"),
    model: text("model"),
    moodId: text("mood_id").references(() => moods.id, {
      onDelete: "set null",
    }),
    systemPromptSnapshot: text("system_prompt_snapshot"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
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
  "ChatMessage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("sessionId")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["system", "user", "assistant", "tool"],
    }).notNull(),
    content: text("content").notNull(),
    model: text("model"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },

  (t) => [index("idx_chat_messages_session").on(t.sessionId)]
);

export const feedItems = sqliteTable(
  "FeedItem",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    url: text("url").notNull().unique(),
    description: text("description"),
    itemType: text("itemType"),
    date: integer("date", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    source: text("source").notNull(),
    imageUrl: text("imageUrl"),
    metadata: text("metadata"),
    embedding: blob("embedding"),
    connectionId: text("connection_id").references(() => connections.id, {
      onDelete: "cascade",
    }),
    resourceId: text("resource_id").references(() => connectionResources.id, {
      onDelete: "cascade",
    }),
  },

  (t) => [
    index("idx_feed_items_connection").on(t.connectionId),
    index("idx_feed_items_resource").on(t.resourceId),
    index("idx_feed_items_source").on(t.source),
    index("idx_feed_items_url").on(t.url),
    index("idx_feed_items_date").on(t.date),
    index("idx_feed_items_created_at").on(t.createdAt),
    index("idx_feed_items_source_date").on(t.source, t.date),
    check(
      "check_metadata_json",
      sql`json_valid(${t.metadata}) OR ${t.metadata} IS NULL`
    ),
  ]
);

export const vecFeedItems = sqliteTable("vec_feed_items", {
  rowid: integer("rowid").primaryKey(),
  embedding: blob("embedding"),
});

export const vecFeedItemMap = sqliteTable(
  "vec_feed_item_map",
  {
    vecRowid: integer("vec_rowid")
      .primaryKey()
      .references(() => vecFeedItems.rowid, { onDelete: "cascade" }),
    feedItemId: integer("feed_item_id")
      .notNull()
      .unique()
      .references(() => feedItems.id, { onDelete: "cascade" }),
  },

  (t) => [index("idx_vec_feed_item_map_feed_item").on(t.feedItemId)]
);

export const feedItemChunks = sqliteTable(
  "FeedItemChunk",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    feedItemId: integer("feed_item_id")
      .notNull()
      .references(() => feedItems.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },

  (t) => [
    index("idx_feed_item_chunks_feed_item").on(t.feedItemId),
    index("idx_feed_item_chunks_chunk_index").on(t.feedItemId, t.chunkIndex),
    uniqueIndex("uniq_feed_item_chunks_item_idx").on(
      t.feedItemId,
      t.chunkIndex
    ),
  ]
);

export const vecChunks = sqliteTable("vec_chunks", {
  rowid: integer("rowid").primaryKey(),
  embedding: blob("embedding"),
});

export const vecChunkMap = sqliteTable(
  "vec_chunk_map",
  {
    vecRowid: integer("vec_rowid").primaryKey(),
    chunkId: integer("chunk_id")
      .notNull()
      .unique()
      .references(() => feedItemChunks.id, { onDelete: "cascade" }),
  },
  (t) => ({
    idxChunk: index("idx_vec_chunk_map_chunk").on(t.chunkId),
  })
);
