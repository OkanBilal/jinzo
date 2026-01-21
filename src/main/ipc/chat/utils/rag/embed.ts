import ollama from "ollama";

import { cachedEmbedding, embeddingCache } from "../rag";
import { DEFAULT_EMBEDDING_CONFIG } from "../../config";

const PREPROCESSING_PATTERNS = {
  MULTIPLE_SPACES: /\s+/g,
  MULTIPLE_NEWLINES: /\n+/g,
} as const;

async function generateEmbeddingCached(
  text: string,
  config = DEFAULT_EMBEDDING_CONFIG
): Promise<number[]> {
  if (!text?.trim()) {
    return new Array(config.dimension).fill(0);
  }

  const preprocessed = preprocessTextForEmbedding(text, config.maxTokens);

  return cachedEmbedding(preprocessed, async (txt) => {
    const res = await ollama.embeddings({
      model: config.model,
      prompt: txt,
    });
    return res.embedding;
  });
}

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
} as const;

async function generateEmbeddingsBatch(
  texts: string[],
  config = DEFAULT_EMBEDDING_CONFIG,
  onProgress?: (current: number, total: number) => void
): Promise<number[][]> {
  const preprocessed = texts.map((t) =>
    preprocessTextForEmbedding(t, config.maxTokens)
  );

  const cachedResults = new Map<number, number[]>();
  const toGenerate: Array<{ index: number; text: string }> = [];

  for (let i = 0; i < preprocessed.length; i++) {
    const cached = embeddingCache.get(preprocessed[i]);
    if (cached) {
      cachedResults.set(i, cached);
    } else {
      toGenerate.push({ index: i, text: preprocessed[i] });
    }
  }

  console.log(`Embedding cache: ${cachedResults.size}/${texts.length} hits`);

  const results: number[][] = new Array(texts.length);
  cachedResults.forEach((embedding, index) => {
    results[index] = embedding;
  });

  for (let i = 0; i < toGenerate.length; i += config.batchSize) {
    const batch = toGenerate.slice(i, i + config.batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(({ text }) => generateEmbeddingWithRetry(text, config))
    );

    batch.forEach(({ index }, batchIndex) => {
      const result = batchResults[batchIndex];
      results[index] =
        result.status === "fulfilled"
          ? result.value
          : new Array(config.dimension).fill(0);
    });

    const processed = Math.min(
      cachedResults.size + i + batch.length,
      texts.length
    );
    onProgress?.(processed, texts.length);
  }

  return results;
}

async function generateEmbeddingWithRetry(
  text: string,
  config = DEFAULT_EMBEDDING_CONFIG,
  retries = RETRY_CONFIG.MAX_RETRIES
): Promise<number[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await generateEmbeddingCached(text, config);
    } catch (error) {
      lastError = error as Error;

      if (isNonRetryableError(error)) {
        console.error("Non-retryable error:", error);
        break;
      }

      if (attempt < retries) {
        const delay =
          RETRY_CONFIG.INITIAL_DELAY_MS *
          Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt);

        console.warn(`Retry ${attempt + 1}/${retries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error("All retries exhausted:", lastError);
  return new Array(config.dimension).fill(0);
}

function isNonRetryableError(error: any): boolean {
  const message = error?.message?.toLowerCase() || "";
  return (
    message.includes("invalid") ||
    message.includes("unauthorized") ||
    message.includes("not found")
  );
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function preprocessTextForEmbedding(
  text: string,
  maxTokens = DEFAULT_EMBEDDING_CONFIG.maxTokens
): string {
  if (!text) return "";

  const cleaned = text
    .trim()
    .replace(PREPROCESSING_PATTERNS.MULTIPLE_SPACES, " ")
    .replace(PREPROCESSING_PATTERNS.MULTIPLE_NEWLINES, "\n");

  const estimatedTokens = estimateTokens(cleaned);
  if (estimatedTokens <= maxTokens) {
    return cleaned;
  }

  const maxChars = maxTokens * 4;
  return cleaned.slice(0, maxChars);
}

export {
  generateEmbeddingCached,
  generateEmbeddingsBatch,
  preprocessTextForEmbedding,
};
