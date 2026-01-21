import { StructuredOutputSchema } from "./types";
import { ItemTypeMetadata, SourceMetadata } from "./utils/rag";

export interface ChatConfig {
  temperature: number;
  top_p: number;
  topK: number;
  minScore: number;
  selectedModel: string;
  toolMode: "chat" | "rag" | "mcp";
  structuredOutputEnabled: boolean;
  structuredOutputSchema: StructuredOutputSchema;
}

export const DEFAULT_MODEL = "gpt-oss:120b-cloud";

export const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";

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


const DEFAULT_CONFIG: ChatConfig = {
  temperature: 0.7,
  top_p: 0.9,
  topK: 10,
  minScore: 0.1,
  selectedModel: DEFAULT_MODEL,
  toolMode: "chat",
  structuredOutputEnabled: false,
  structuredOutputSchema: { properties: [] },
};

const chatConfig: ChatConfig = { ...DEFAULT_CONFIG };

export function getChatConfig(): ChatConfig {
  return { ...chatConfig };
}

export function updateChatConfig(payload: Partial<ChatConfig>): ChatConfig {
  if (typeof payload.temperature === "number") {
    chatConfig.temperature = Math.max(0, Math.min(2, payload.temperature));
  }

  if (typeof payload.top_p === "number") {
    chatConfig.top_p = Math.max(0, Math.min(1, payload.top_p));
  }

  if (typeof payload.topK === "number") {
    chatConfig.topK = Math.max(1, Math.min(100, payload.topK));
  }

  if (typeof payload.minScore === "number") {
    chatConfig.minScore = Math.max(0, Math.min(1, payload.minScore));
  }

  if (typeof payload.selectedModel === "string") {
    chatConfig.selectedModel = payload.selectedModel;
  }

  if (
    payload.toolMode === "chat" ||
    payload.toolMode === "rag" ||
    payload.toolMode === "mcp"
  ) {
    chatConfig.toolMode = payload.toolMode;
  }

  if (typeof payload.structuredOutputEnabled === "boolean") {
    chatConfig.structuredOutputEnabled = payload.structuredOutputEnabled;
  }

  if (
    payload.structuredOutputSchema &&
    Array.isArray(payload.structuredOutputSchema.properties)
  ) {
    chatConfig.structuredOutputSchema = payload.structuredOutputSchema;
  }

  return { ...chatConfig };
}

export const CACHE_DEFAULTS = {
  EMBEDDING_MAX_SIZE: 500,
  EMBEDDING_TTL_MINUTES: 120,
  QUERY_MAX_SIZE: 100,
  QUERY_TTL_MINUTES: 30,
  RESPONSE_MAX_SIZE: 50,
  RESPONSE_TTL_MINUTES: 15,
} as const;





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


export const DEFAULT_EMBEDDING_CONFIG = {
  model: "nomic-embed-text:latest",
  dimension: 768,
  maxTokens: 8192,
  batchSize: 20,
} as const;



// PROMPT OPTIMIZER CONSTANTS

export const DEFAULT_MAX_TOKENS = 4000;

export const MIN_KEYWORD_LENGTH = 3;

export const MAX_KEYWORDS = 5;

export const SOURCES = [
  {
    id: "github",
    displayName: "GitHub",
    patterns: ["github", "gh\\b", "octokit", "repository", "repo\\b"],
    itemTypes: ["issue", "pull-request"],
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
    patterns: ["raindrop", "bookmark", "saved\\s*link"],
    itemTypes: ["bookmark"],
  },
  {
    id: "podcast",
    displayName: "Podcast",
    patterns: [
      "podcast",
      "episode",
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
    patterns: ["issue", "bug", "ticket", "problem"],
    sources: ["github"],
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
  },
  {
    id: "news",
    displayName: "News",
    patterns: ["news", "story", "article"],
    sources: ["hackernews"],
  },
  {
    id: "bookmark",
    displayName: "Bookmark",
    patterns: ["bookmark", "saved\\s*link", "reading\\s*list"],
    sources: ["raindrop", "notion"],
  },
  {
    id: "episode",
    displayName: "Episode",
    patterns: ["episode", "podcast\\s*episode", "show"],
    sources: ["podcast"],
  },
  {
    id: "article",
    displayName: "Article",
    patterns: ["article", "post", "blog", "essay"],
    sources: ["new-yorker", "a-working-library"],
  },
  {
    id: "track",
    displayName: "Track",
    patterns: ["track", "song", "music"],
    sources: ["spotify", "applemusic"],
  },
  {
    id: "playlist",
    displayName: "Playlist",
    patterns: ["playlist"],
    sources: ["spotify", "applemusic", "youtube"],
  },
  {
    id: "video",
    displayName: "Video",
    patterns: ["video"],
    sources: ["youtube"],
  },
] as const satisfies readonly ItemTypeMetadata[];

export const SYSTEM_PROMPT =
  "You are a helpful assistant with access to the user's personal knowledge base of entities from various sources. Use the provided context to answer questions accurately. Pay close attention to the KIND and SOURCE of each entity - they indicate what type of content it is (issue, bookmark, podcast_episode, track, video, etc.) and where it comes from (GitHub, Hacker News, Raindrop, Apple Music, Spotify, etc.). For bookmarks and other saved content, metadata fields often contain valuable information like tags, artists, albums, or categories. IMPORTANT: When listing entities, ALWAYS include their URLs as clickable markdown links using [Title](URL) format. Do NOT use citation markers like [1] or footnote references - keep responses clean and readable. If you need to make reasonable inferences based on the context, do so. Explain if the context is completely unrelated to the question.";

export const NO_RELEVANT_CONTENT_SYSTEM_PROMPT =
  "You are a helpful AI assistant with access to a personal knowledge base. " +
  "The user asked a question, but no relevant entities were found in their knowledge base. " +
  "Respond helpfully - if it's a general question, answer it naturally. " +
  "If it seems like they're looking for specific content from their knowledge base, suggest that they might need to " +
  "sync their connections or add more data sources. Be friendly and helpful.";

export const USER_PROMPT_PREFIX =
  "Answer the QUESTION using the information from the CONTEXT below. Pay attention to KIND (entity type), metadata (contains tags, artists, categories, etc.), and URL fields. When listing entities, format them as markdown links: [Title](URL). Include relevant metadata like kind and key details from the metadata field. Do not add citation markers or footnotes.\n\nCONTEXT:\n";

export const USER_PROMPT_SUFFIX = "\n\nQUESTION:\n";


// RETRIEVAL

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

export const BM25_PARAMS = {
  K1: 1.5,
  B: 0.75,
} as const;



// SYNC

export const FETCH_LIMITS = {
  GITHUB_ISSUES: 10,
  GITHUB_PRS: 10,
  RAINDROP: 10,
  HACKERNEWS_TOP: 10,
  HACKERNEWS_NEW: 10,
  HACKERNEWS_USER: 10,
  PODCASTS: 5,
  RSS: 5,
} as const;


export const IMAGE_SRC_REGEX = /<img[^>]+src=["']([^"'>]+)["']/i;
