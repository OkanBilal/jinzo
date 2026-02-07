import { DEFAULT_EMBEDDING_PATTERNS, DEFAULT_OLLAMA_HOST, EMBEDDING_FAMILY_PATTERNS } from "../chat/chat.constants";
import type { OllamaModel, OllamaShowResponse } from "./ollama.dto";

// ─────────────────────────────────────────────────────────────
// URL Helpers
// ─────────────────────────────────────────────────────────────
export function getOllamaHost(): string {
  const host = process.env.OLLAMA_HOST?.trim() || DEFAULT_OLLAMA_HOST;
  return host.replace(/\/$/, "");
}

export function getTagsUrl(): string {
  return `${getOllamaHost()}/api/tags`;
}

export function getShowUrl(): string {
  return `${getOllamaHost()}/api/show`;
}

export function getGenerateUrl(): string {
  return `${getOllamaHost()}/api/generate`;
}

// ─────────────────────────────────────────────────────────────
// Embedding Detection
// ─────────────────────────────────────────────────────────────
export function getEmbeddingRegex(): RegExp {
  const envPattern = process.env.OLLAMA_EMBEDDING_NAME_REGEX;

  if (!envPattern) {
    return new RegExp(DEFAULT_EMBEDDING_PATTERNS.join("|"), "i");
  }

  try {
    return new RegExp(envPattern, "i");
  } catch (err) {
    console.warn(
      `Invalid OLLAMA_EMBEDDING_NAME_REGEX: "${envPattern}". Using default pattern.`,
      err
    );
    return new RegExp(DEFAULT_EMBEDDING_PATTERNS.join("|"), "i");
  }
}

export function getModelFamilies(model: OllamaModel): string[] {
  if (!model.details) {
    return [];
  }

  if (model.details.families) {
    return model.details.families;
  }

  if (model.details.family) {
    return [model.details.family];
  }

  return [];
}

export function isEmbeddingModel(model: OllamaModel, embeddingRegex: RegExp): boolean {
  const nameMatch = embeddingRegex.test(model.name);
  if (nameMatch) {
    return true;
  }

  const families = getModelFamilies(model);
  const familyPattern = new RegExp(EMBEDDING_FAMILY_PATTERNS.join("|"), "i");
  const familyMatch = families.some((family: string) =>
    familyPattern.test(family)
  );

  return familyMatch;
}

export function processModels(
  models: OllamaModel[],
  embeddingRegex: RegExp
): string[] {
  return models
    .filter((model) => !isEmbeddingModel(model, embeddingRegex))
    .map((model) => model.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

// ─────────────────────────────────────────────────────────────
// Thinking Support Detection
// ─────────────────────────────────────────────────────────────
export function determineThinkingSupport(
  modelName: string,
  apiCapabilities?: OllamaShowResponse["capabilities"]
): boolean {
  if (apiCapabilities?.reasoning === true) {
    return true;
  }

  const modelLower = modelName.toLowerCase();
  const thinkingPatterns = [
    "gpt-oss",
    "qwen3",
    "deepseek-v3",
    "deepseek-r1",
    "o1",
    "reasoning",
  ];

  return thinkingPatterns.some((pattern) => modelLower.includes(pattern));
}
