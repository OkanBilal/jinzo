import {
  DEFAULT_EMBEDDING_PATTERNS,
  DEFAULT_OLLAMA_HOST,
  EMBEDDING_FAMILY_PATTERNS,
} from "../../../renderer/lib/config";
import type { OllamaModel, OllamaShowResponse } from "./types";

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

export function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: "Clear",
    1: "Partly Cloudy",
    2: "Partly Cloudy",
    3: "Partly Cloudy",
    45: "Foggy",
    48: "Foggy",
    51: "Light Rain",
    53: "Moderate Rain",
    55: "Heavy Rain",
    56: "Freezing Rain",
    57: "Freezing Rain",
    61: "Light Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    71: "Light Snow",
    73: "Moderate Snow",
    75: "Heavy Snow",
    77: "Snow Grains",
    80: "Light Showers",
    81: "Moderate Showers",
    82: "Heavy Showers",
    85: "Snow Showers",
    86: "Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm",
    99: "Thunderstorm",
  };

  return conditions[code] || "Unknown";
}

export function cleanThinkingTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .trim();
}
