import { ChunkConfig, TextChunk } from "../rag";
import {
  DEFAULT_CHUNK_CONFIG,
  CHARS_PER_TOKEN,
  MIN_DESCRIPTION_LENGTH,
  SPLIT_PATTERNS,
  TEXT_LENGTH_THRESHOLDS,
} from "../../config";

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(SPLIT_PATTERNS.SENTENCE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(SPLIT_PATTERNS.PARAGRAPH)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitIntoWords(text: string): string[] {
  return text.split(SPLIT_PATTERNS.WORD).filter((w) => w.length > 0);
}

function normalizeWhitespace(text: string): string {
  return text.replace(SPLIT_PATTERNS.WHITESPACE_NORMALIZE, " ").trim();
}

function createChunk(content: string, index: number): TextChunk {
  return {
    content: content.trim(),
    index,
    tokenCount: estimateTokenCount(content),
  };
}

function filterChunksBySize(chunks: TextChunk[], minSize: number): TextChunk[] {
  if (chunks.length === 1) return chunks;

  const filtered = chunks.filter((chunk) => chunk.content.length >= minSize);
  return filtered.length > 0 ? filtered : chunks;
}

function chunkText(text: string, config: ChunkConfig = {}): TextChunk[] {
  const cfg = { ...DEFAULT_CHUNK_CONFIG, ...config } as Required<ChunkConfig>;
  const chunks: TextChunk[] = [];

  const normalizedText = normalizeWhitespace(text);
  if (normalizedText.length <= cfg.maxChunkSize) {
    return [createChunk(normalizedText, 0)];
  }
  let segments: string[] = [];
  switch (cfg.splitOn) {
    case "paragraph":
      segments = splitIntoParagraphs(normalizedText);
      break;
    case "sentence":
      segments = splitIntoSentences(normalizedText);
      break;
    case "word":
      segments = splitIntoWords(normalizedText);
      break;
  }
  let currentChunk = "";
  let chunkIndex = 0;
  const separator = " ";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const potentialChunk = currentChunk
      ? currentChunk + separator + segment
      : segment;
    if (potentialChunk.length > cfg.maxChunkSize && currentChunk.length > 0) {
      chunks.push(createChunk(currentChunk, chunkIndex++));
      const overlapText = currentChunk.slice(-cfg.overlap);
      currentChunk = overlapText + separator + segment;
    } else {
      currentChunk = potentialChunk;
    }
    if (i === segments.length - 1 && currentChunk.length > 0) {
      chunks.push(createChunk(currentChunk, chunkIndex++));
    }
  }
  return filterChunksBySize(chunks, cfg.minChunkSize);
}

function chunkEntity(
  title: string,
  body: string | null,
  config: ChunkConfig = {}
): TextChunk[] {
  const titleText = `${title}`;
  const bodyText = body || "";

  if (!bodyText) {
    return [createChunk(titleText, 0)];
  }

  if (bodyText.length < MIN_DESCRIPTION_LENGTH) {
    const combined = `${titleText} — ${bodyText}`;
    return [createChunk(combined, 0)];
  }

  const fullText = `${titleText}\n\n${bodyText}`;
  return chunkText(fullText, config);
}

/**
 * @deprecated Use chunkEntity instead
 */
const chunkFeedItem = chunkEntity;

function getOptimalChunkConfig(textLength: number): ChunkConfig {
  if (textLength < TEXT_LENGTH_THRESHOLDS.VERY_SHORT) {
    return {
      maxChunkSize: 1000,
      minChunkSize: 50,
      overlap: 0,
      splitOn: "paragraph",
    };
  }
  if (textLength < TEXT_LENGTH_THRESHOLDS.SHORT) {
    return {
      maxChunkSize: 500,
      minChunkSize: 100,
      overlap: 50,
      splitOn: "paragraph",
    };
  }
  if (textLength < TEXT_LENGTH_THRESHOLDS.MEDIUM) {
    return {
      maxChunkSize: 500,
      minChunkSize: 150,
      overlap: 75,
      splitOn: "sentence",
    };
  }
  if (textLength < TEXT_LENGTH_THRESHOLDS.LONG) {
    return {
      maxChunkSize: 400,
      minChunkSize: 150,
      overlap: 100,
      splitOn: "sentence",
    };
  }

  return {
    maxChunkSize: 350,
    minChunkSize: 150,
    overlap: 100,
    splitOn: "sentence",
  };
}

function analyzeTextStructure(text: string): {
  paragraphCount: number;
  sentenceCount: number;
  averageSentenceLength: number;
  suggestedStrategy: "paragraph" | "sentence" | "word";
} {
  const paragraphs = splitIntoParagraphs(text);
  const sentences = splitIntoSentences(text);
  const avgSentenceLength = text.length / sentences.length;

  let suggestedStrategy: "paragraph" | "sentence" | "word" = "sentence";

  if (paragraphs.length > 3 && paragraphs.length < 10) {
    suggestedStrategy = "paragraph";
  } else if (avgSentenceLength < 50) {
    suggestedStrategy = "sentence";
  } else if (avgSentenceLength > 200) {
    suggestedStrategy = "word";
  }

  if (sentences.length === 0) {
    return {
      paragraphCount: paragraphs.length,
      sentenceCount: 0,
      averageSentenceLength: 0,
      suggestedStrategy: "word",
    };
  }

  return {
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
    averageSentenceLength: Math.round(avgSentenceLength),
    suggestedStrategy,
  };
}

export {
  chunkText,
  chunkEntity,
  chunkFeedItem, // deprecated alias
  getOptimalChunkConfig,
  analyzeTextStructure,
};
