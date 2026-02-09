// ─────────────────────────────────────────────────────────────
// Default Model
// ─────────────────────────────────────────────────────────────
export const DEFAULT_MODEL = "gpt-oss:120b-cloud";

export const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";

// ─────────────────────────────────────────────────────────────
// Embedding Patterns
// ─────────────────────────────────────────────────────────────
export const DEFAULT_EMBEDDING_PATTERNS = [
  "embed",
  "embedding",
  "all-minilm",
  "gte",
  "e5",
  "bge",
  "mpnet",
  "nomic",
  "text-embedding",
  "jina",
  "rerank",
  "reranker",
] as const;

export const EMBEDDING_FAMILY_PATTERNS = [
  "embed",
  "bert",
  "gte",
  "bge",
  "e5",
  "mpnet",
  "minilm",
  "jina",
  "rerank",
] as const;

// ─────────────────────────────────────────────────────────────
// Cache Defaults
// ─────────────────────────────────────────────────────────────
export const CACHE_DEFAULTS = {
  EMBEDDING_MAX_SIZE: 500,
  EMBEDDING_TTL_MINUTES: 120,
  QUERY_MAX_SIZE: 100,
  QUERY_TTL_MINUTES: 30,
  RESPONSE_MAX_SIZE: 50,
  RESPONSE_TTL_MINUTES: 15,
} as const;

// ─────────────────────────────────────────────────────────────
// Chunk Config
// ─────────────────────────────────────────────────────────────
export const DEFAULT_CHUNK_CONFIG = {
  maxChunkSize: 500,
  minChunkSize: 100,
  overlap: 50,
  splitOn: "sentence" as const,
} as const;

export const CHARS_PER_TOKEN = 4;

export const MIN_DESCRIPTION_LENGTH = 50;

export const SPLIT_PATTERNS = {
  SENTENCE: /(?<=[.!?])\s+/,
  PARAGRAPH: /\n\n+/,
  WORD: /\s+/,
  WHITESPACE_NORMALIZE: /\s+/g,
} as const;

export const TEXT_LENGTH_THRESHOLDS = {
  VERY_SHORT: 200,
  SHORT: 500,
  MEDIUM: 1500,
  LONG: 3000,
} as const;

// ─────────────────────────────────────────────────────────────
// Embedding Config
// ─────────────────────────────────────────────────────────────
export const DEFAULT_EMBEDDING_CONFIG = {
  model: "nomic-embed-text:latest",
  dimension: 768,
  maxTokens: 8192,
  batchSize: 20,
} as const;

// ─────────────────────────────────────────────────────────────
// Prompt Optimizer Constants
// ─────────────────────────────────────────────────────────────
export const DEFAULT_MAX_TOKENS = 4000;

export const MIN_KEYWORD_LENGTH = 3;

export const MAX_KEYWORDS = 5;

// ─────────────────────────────────────────────────────────────
// Sources
// ─────────────────────────────────────────────────────────────
interface SourceMetadata {
  id: string;
  displayName: string;
  patterns: readonly string[];
  itemTypes: readonly string[];
}

interface ItemTypeMetadata {
  id: string;
  displayName: string;
  patterns: readonly string[];
  sources: readonly string[];
  entityKinds: readonly string[];
}

export const SOURCES = [
  {
    id: "github",
    displayName: "GitHub",
    patterns: ["github", "gh\\b", "octokit", "repository", "repo\\b"],
    itemTypes: ["issue", "pull-request"],
  },
  {
    id: "linear",
    displayName: "Linear",
    patterns: ["linear", "linear\\s*app", "linear\\s*issue"],
    itemTypes: ["issue"],
  },
  {
    id: "asana",
    displayName: "Asana",
    patterns: ["asana", "asana\\s*task", "asana\\s*project"],
    itemTypes: ["issue"],
  },
  {
    id: "jira",
    displayName: "Jira",
    patterns: ["jira", "jira\\s*issue", "jira\\s*ticket"],
    itemTypes: ["issue"],
  },
  {
    id: "hackernews",
    displayName: "Hacker News",
    patterns: ["hacker\\s*news", "hackernews", "\\bhn\\b", "ycombinator"],
    itemTypes: ["news"],
  },
  {
    id: "raindrop",
    displayName: "Raindrop",
    patterns: ["raindrop", "saved\\s*link"],
    itemTypes: ["bookmark"],
  },
  {
    id: "rss",
    displayName: "RSS",
    patterns: ["rss", "rss\\s*feed", "\\bfeed\\b", "blog\\s*post"],
    itemTypes: ["article"],
  },
  {
    id: "podcast",
    displayName: "Podcast",
    patterns: [
      "podcast",
      "audio\\s*show",
      "hard\\s*fork",
      "science\\s*vs",
    ],
    itemTypes: ["episode"],
  },
  {
    id: "spotify",
    displayName: "Spotify",
    patterns: ["spotify"],
    itemTypes: ["track", "playlist"],
  },
  {
    id: "applemusic",
    displayName: "Apple Music",
    patterns: ["apple\\s*music", "applemusic"],
    itemTypes: ["track", "playlist"],
  },
  {
    id: "youtube",
    displayName: "YouTube",
    patterns: ["youtube", "yt\\b"],
    itemTypes: ["video", "playlist"],
  },
  {
    id: "notion",
    displayName: "Notion",
    patterns: ["notion"],
    itemTypes: ["note", "bookmark"],
  },
] as const satisfies readonly SourceMetadata[];

export const ITEM_TYPES = [
  {
    id: "issue",
    displayName: "Issue",
    patterns: ["issue", "bug", "ticket", "problem", "task"],
    sources: ["github", "linear", "asana", "jira"],
    entityKinds: ["issue"],
  },
  {
    id: "pull-request",
    displayName: "Pull Request",
    patterns: [
      "pull\\s*request",
      "\\bpr\\b",
      "merge\\s*request",
      "code\\s*review",
    ],
    sources: ["github"],
    entityKinds: ["pull_request"],
  },
  {
    id: "news",
    displayName: "News",
    patterns: ["news", "\\bstory\\b", "hn\\s*post"],
    sources: ["hackernews"],
    entityKinds: ["hn_story", "hn_comment"],
  },
  {
    id: "bookmark",
    displayName: "Bookmark",
    patterns: ["bookmark", "saved\\s*link", "reading\\s*list"],
    sources: ["raindrop", "notion"],
    entityKinds: ["bookmark", "notion_bookmark"],
  },
  {
    id: "episode",
    displayName: "Episode",
    patterns: ["podcast\\s*episode", "\\bepisode\\b"],
    sources: ["podcast"],
    entityKinds: ["podcast_episode"],
  },
  {
    id: "article",
    displayName: "Article",
    patterns: ["\\barticle\\b", "blog\\s*post", "essay", "rss"],
    sources: ["rss"],
    entityKinds: ["rss_article"],
  },
  {
    id: "note",
    displayName: "Note",
    patterns: ["\\bnote\\b", "\\bpage\\b", "notion\\s*page", "document"],
    sources: ["notion"],
    entityKinds: ["notion_page"],
  },
  {
    id: "track",
    displayName: "Track",
    patterns: ["track", "song", "music"],
    sources: ["spotify", "applemusic"],
    entityKinds: ["spotify_track", "apple_music_track"],
  },
  {
    id: "playlist",
    displayName: "Playlist",
    patterns: ["playlist"],
    sources: ["spotify", "applemusic", "youtube"],
    entityKinds: ["spotify_playlist", "apple_music_playlist", "youtube_playlist"],
  },
  {
    id: "video",
    displayName: "Video",
    patterns: ["video", "youtube\\s*video", "channel"],
    sources: ["youtube"],
    entityKinds: ["youtube_channel"],
  },
] as const satisfies readonly ItemTypeMetadata[];

// ─────────────────────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────────────────────
export const SYSTEM_PROMPT =
  "You are a helpful assistant with access to the user's personal knowledge base of entities from various sources. " +
  "Use the provided context to answer questions accurately.\n\n" +
  "ENTITY FIELDS:\n" +
  "- Source: where it comes from (GitHub, Hacker News, Raindrop, Spotify, Apple Music, YouTube, Notion, RSS, Jira, etc.)\n" +
  "- Type: what kind of content it is (Issue, Pull Request, Bookmark, Track, Episode, Article, Note, Video, etc.)\n" +
  "- Metadata: tags, artists, albums, categories, labels, and other structured data\n\n" +
  "FORMATTING RULES:\n" +
  "- ALWAYS format entity references as markdown links: [Title](URL)\n" +
  "- Do NOT use citation markers like [1] or footnote references\n" +
  "- Include relevant metadata (tags, artists, status, labels) when useful\n\n" +
  "QUERY HANDLING:\n" +
  "- For comparisons (\"which is newer\", \"compare these\"), present entities side by side with key differences\n" +
  "- For counting/aggregation (\"how many\", \"list all\"), provide a clear count and organized list\n" +
  "- For exploratory queries (\"what do I have about X\"), group results by type or source\n" +
  "- If the context is unrelated to the question, say so and answer from general knowledge if possible";

export const NO_RELEVANT_CONTENT_SYSTEM_PROMPT =
  "You are a helpful AI assistant with access to a personal knowledge base. " +
  "The user asked a question, but no relevant entities were found in their knowledge base. " +
  "Respond helpfully - if it's a general question, answer it naturally. " +
  "If it seems like they're looking for specific content from their knowledge base, suggest that they might need to " +
  "sync their connections or add more data sources. Be friendly and helpful.";

export const USER_PROMPT_PREFIX =
  "Answer the QUESTION using the CONTEXT below.\n\nCONTEXT:\n";

export const USER_PROMPT_SUFFIX = "\n\nQUESTION:\n";

// ─────────────────────────────────────────────────────────────
// Retrieval Constants
// ─────────────────────────────────────────────────────────────
export const MIN_TOKEN_LENGTH = 3;

export const DEFAULT_DECAY_LAMBDA = 0.02;

export const TIME_CONSTANTS = {
  MS_PER_DAY: 1000 * 60 * 60 * 24,
  MS_PER_SECOND: 1000,
} as const;

export const MAX_PER_SOURCE_RATIO = 0.5;

export const DISTANCE_BOUNDS = {
  MAX: 2,
  MIN: 0,
} as const;

// ─────────────────────────────────────────────────────────────
// Sync Limits
// ─────────────────────────────────────────────────────────────


export const IMAGE_SRC_REGEX = /<img[^>]+src=["']([^"'>]+)["']/i;

// ─────────────────────────────────────────────────────────────
// IPC Channels
// ─────────────────────────────────────────────────────────────
export const IPC_CHANNELS = {
  // Config
  GET_CONFIG: "chat:getConfig",
  UPDATE_CONFIG: "chat:updateConfig",
  // Session
  GET_SESSIONS: "chat:getSessions",
  GET_SESSION_BY_ID: "chat:getSessionById",
  CREATE_SESSION: "chat:createSession",
  UPDATE_TITLE: "chat:updateTitle",
  GENERATE_TITLE: "chat:generateTitle",
  DELETE_SESSION: "chat:deleteSession",
  // Messages
  GET_MESSAGES: "chat:getMessages",
  // Chat
  SEND: "chat:send",
} as const;
