import { SourceMetadata, ItemTypeMetadata } from "../rag";

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
  "You are a helpful assistant analyzing personalized feed content. Use the provided context to answer questions accurately. Pay close attention to the SOURCE and TYPE of each item - they indicate where the information comes from (GitHub, Hacker News, Raindrop bookmarks, podcasts, etc.) and what kind of content it is (issue, article, bookmark, episode, etc.). For bookmarks, pay special attention to TAGS - they are critical for filtering and finding specific content. IMPORTANT: When listing items, ALWAYS include their URLs as clickable markdown links using [Title](URL) format. Do NOT use citation markers like [1] or footnote references - keep responses clean and readable. If you need to make reasonable inferences based on the context, do so. Explain if the context is completely unrelated to the question.";

export const NO_RELEVANT_CONTENT_SYSTEM_PROMPT =
  "You are a helpful AI assistant for a personalized feed application. " +
  "The user asked a question, but no relevant content was found in their feed. " +
  "Respond helpfully - if it's a general question, answer it naturally. " +
  "If it seems like they're looking for specific feed content, suggest that they might need to " +
  "add more sources or wait for content to be indexed. Be friendly and helpful.";

export const USER_PROMPT_PREFIX =
  "Answer the QUESTION using the information from the CONTEXT below. Pay attention to SOURCE, TYPE, TAGS, and URL fields. When listing items, format them as markdown links: [Title](URL). Include relevant metadata like Type and Tags. Do not add citation markers or footnotes.\n\nCONTEXT:\n";

export const USER_PROMPT_SUFFIX = "\n\nQUESTION:\n";
