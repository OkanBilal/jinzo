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