import { PromptBuilderOptions, RetrievedEntity } from "../rag";
import { SourceId, ItemTypeId, QueryAnalysis } from "../rag/types";

import {
  CHARS_PER_TOKEN,
  DEFAULT_MAX_TOKENS,
  MIN_KEYWORD_LENGTH,
  MAX_KEYWORDS,
  SYSTEM_PROMPT,
  USER_PROMPT_PREFIX,
  USER_PROMPT_SUFFIX,
  SOURCES,
  ITEM_TYPES,
} from "../../config";

function createRegex(pattern: string): RegExp {
  return new RegExp(pattern, "i");
}

function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

// Detect sources mentioned in the query based on predefined patterns !!!
function detectSourcesFromQuery(query: string): SourceId[] {
  const normalized = normalizeQuery(query);
  const matches: Array<{ sourceId: SourceId; score: number; pattern: string }> =
    [];

  for (const source of SOURCES) {
    const sortedPatterns = [...source.patterns].sort(
      (a, b) => b.length - a.length
    );

    for (const pattern of sortedPatterns) {
      const regex = createRegex(pattern);
      if (regex.test(normalized)) {
        matches.push({
          sourceId: source.id,
          score: pattern.length,
          pattern,
        });
        break;
      }
    }
  }

  const podcastMatch = matches.find(
    (m) => m.sourceId === "podcast" && m.pattern.includes("\\s")
  );
  const githubMatch = matches.find((m) => m.sourceId === "github");

  if (podcastMatch && githubMatch && podcastMatch.score > githubMatch.score) {
    return matches
      .filter((m) => m.sourceId !== "github")
      .sort((a, b) => b.score - a.score)
      .map((m) => m.sourceId);
  }

  return matches.sort((a, b) => b.score - a.score).map((m) => m.sourceId);
}

// Detect item types mentioned in the query based on predefined patterns !!!
function detectItemTypesFromQuery(query: string): ItemTypeId[] {
  const normalized = normalizeQuery(query);
  const matches: Array<{ itemTypeId: ItemTypeId; score: number }> = [];

  for (const itemType of ITEM_TYPES) {
    const sortedPatterns = [...itemType.patterns].sort(
      (a, b) => b.length - a.length
    );

    for (const pattern of sortedPatterns) {
      const regex = createRegex(pattern);
      if (regex.test(normalized)) {
        matches.push({
          itemTypeId: itemType.id,
          score: pattern.length,
        });
        break;
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score).map((m) => m.itemTypeId);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function optimizeContext(
  items: RetrievedEntity[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
  includeMetadata = false
): RetrievedEntity[] {
  const optimized: RetrievedEntity[] = [];
  let currentTokens = 0;

  for (const item of items) {
    const itemText = formatItemForContext(item, includeMetadata);
    const itemTokens = estimateTokens(itemText);
    if (currentTokens + itemTokens <= maxTokens) {
      optimized.push(item);
      currentTokens += itemTokens;
    } else {
      break;
    }
  }
  return optimized;
}

export function formatItemForContext(
  item: RetrievedEntity,
  includeMetadata = false
): string {
  const parts = [
    `Source: ${item.kind}`,
    `Type: ${item.kind}`,
    `Title: ${item.title}`,
    `URL: ${item.url}`,
  ];

  if (item.summary) {
    parts.push(`Content: ${item.summary}`);
  }
  if (item.occurredAt) {
    parts.push(`Date: ${item.occurredAt.toLocaleDateString()}`);
  }
  if (item.kind === "bookmark" && item.metadata?.tags) {
    const tags = Array.isArray(item.metadata.tags) ? item.metadata.tags : [];
    if (tags.length > 0) {
      parts.push(`Tags: ${tags.join(", ")}`);
    }
  }
  if (includeMetadata && item.metadata) {
    parts.push(`Additional Info: ${JSON.stringify(item.metadata)}`);
  }
  return parts.join("\n");
}

function buildOptimizedPrompt(
  question: string,
  items: RetrievedEntity[],
  options: PromptBuilderOptions = {}
): {
  systemPrompt: string;
  userPrompt: string;
  usedItems: RetrievedEntity[];
} {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    includeMetadata = false,
    prioritizeSources = [],
  } = options;

  const includeMetadataFinal =
    includeMetadata ||
    question.toLowerCase().includes("tag")
  let sortedItems = [...items];
  if (prioritizeSources.length > 0) {
    sortedItems = sortedItems.sort((a, b) => {
      const aIndex = prioritizeSources.indexOf(a.kind as SourceId);
      const bIndex = prioritizeSources.indexOf(b.kind as SourceId);
      const aPriority = aIndex === -1 ? Infinity : aIndex;
      const bPriority = bIndex === -1 ? Infinity : bIndex;
      return aPriority - bPriority || b.score - a.score;
    });
  }
  const usedItems = optimizeContext(
    sortedItems,
    maxTokens,
    includeMetadataFinal
  );
  const context = usedItems
    .map(
      (item, idx) =>
        `\n[${idx + 1}] ${formatItemForContext(item, includeMetadataFinal)}`
    )
    .join("\n\n");
  const userPrompt = `${USER_PROMPT_PREFIX}${context}${USER_PROMPT_SUFFIX}${question}`;
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    usedItems,
  };
}

export function detectSources(query: string): SourceId[] {
  return detectSourcesFromQuery(query);
}

export function detectItemTypes(query: string): ItemTypeId[] {
  return detectItemTypesFromQuery(query);
}

function analyzeQuery(query: string): QueryAnalysis {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[.,!?;:()"'`]/g, ""))
    .filter((word) => word.length >= MIN_KEYWORD_LENGTH)
    .slice(0, MAX_KEYWORDS);

  const detectedSources = detectSources(query);
  const detectedItemTypes = detectItemTypes(query);

  return {
    keywords,
    detectedSources,
    detectedItemTypes,
  };
}

export { buildOptimizedPrompt, analyzeQuery };
