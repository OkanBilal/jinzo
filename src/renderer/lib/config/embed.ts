export const DEFAULT_EMBEDDING_CONFIG = {
  model: "nomic-embed-text:latest",
  dimension: 768,
  maxTokens: 8192,
  batchSize: 20,
} as const;