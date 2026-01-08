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
