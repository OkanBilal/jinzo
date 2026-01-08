import { ipcMain } from "electron";
import {
  DEFAULT_EMBEDDING_PATTERNS,
  DEFAULT_OLLAMA_HOST,
  EMBEDDING_FAMILY_PATTERNS,
} from "../../renderer/lib/config";

export interface OllamaModelDetails {
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

export interface OllamaModel {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: OllamaModelDetails;
}

interface OllamaShowResponse {
  modelfile?: string;
  parameters?: string;
  template?: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
  model_info?: {
    [key: string]: any;
  };
  capabilities?: {
    completion?: boolean;
    chat?: boolean;
    embeddings?: boolean;
    tools?: boolean;
    vision?: boolean;
    reasoning?: boolean;
  };
}

interface ShowApiResponse {
  modelName: string;
  supportsThinking: boolean;
  capabilities?: {
    completion?: boolean;
    chat?: boolean;
    embeddings?: boolean;
    tools?: boolean;
    vision?: boolean;
    reasoning?: boolean;
  };
  details?: {
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface WeatherInsightRequest {
  temperature: number;
  weatherCode: number;
  windspeed?: number;
  location: {
    lat: number;
    lon: number;
  };
}

// Helper functions
function getOllamaHost(): string {
  const host = process.env.OLLAMA_HOST?.trim() || DEFAULT_OLLAMA_HOST;
  return host.replace(/\/$/, "");
}

function getTagsUrl(): string {
  return `${getOllamaHost()}/api/tags`;
}

function getShowUrl(): string {
  return `${getOllamaHost()}/api/show`;
}

function getEmbeddingRegex(): RegExp {
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

function getModelFamilies(model: OllamaModel) {
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

function isEmbeddingModel(model: OllamaModel, embeddingRegex: RegExp): boolean {
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

function processModels(
  models: OllamaModel[],
  embeddingRegex: RegExp
): string[] {
  return models
    .filter((model) => !isEmbeddingModel(model, embeddingRegex))
    .map((model) => model.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function determineThinkingSupport(
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

function getWeatherCondition(code: number): string {
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

/**
 * Register all IPC handlers for Ollama operations
 */
export function registerOllamaHandlers() {
  // Get list of Ollama models (excluding embedding models)
  ipcMain.handle("ollama:getModels", async () => {
    try {
      const url = getTagsUrl();

      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(
          `Ollama API returned status ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      const embeddingRegex = getEmbeddingRegex();
      const models = processModels(data.models ?? [], embeddingRegex);

      return { success: true, data: { models } };
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch Ollama models";
      return { success: false, error: errorMessage };
    }
  });

  // Get model info by model name
  ipcMain.handle("ollama:showModel", async (_, modelName: string) => {
    try {
      if (!modelName) {
        return { success: false, error: "Model name is required" };
      }

      const url = getShowUrl();

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: modelName }),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Ollama API returned status ${response.status}: ${response.statusText}`
        );
      }

      const data: OllamaShowResponse = await response.json();

      const supportsThinking = determineThinkingSupport(modelName, data.capabilities);

      const result: ShowApiResponse = {
        modelName,
        supportsThinking,
        capabilities: data.capabilities,
        details: data.details,
      };

      return { success: true, data: result };
    } catch (error) {
      console.error("Failed to fetch model info from Ollama:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch model info";
      return { success: false, error: errorMessage };
    }
  });

  // Get weather insight using Ollama
  ipcMain.handle("ollama:getWeatherInsight", async (_, payload: WeatherInsightRequest) => {
    try {
      const { temperature, weatherCode, windspeed } = payload;

      const condition = getWeatherCondition(weatherCode);

      const prompt = `Write a single friendly sentence about this weather: ${temperature}°C, ${condition}, wind ${windspeed || 0} km/h. Give a helpful tip or observation. Be brief and conversational.`;

      const ollamaHost = getOllamaHost();
      const response = await fetch(`${ollamaHost}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-oss:120b-cloud",
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 200,
            stop: ["\n\n", "Weather Data:", "---"],
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Ollama API error details:", errorText);
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();

      let insight = data.response || "Weather looks interesting today!";
      
      insight = insight
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
        .trim();

      return {
        success: true,
        data: {
          insight: insight.trim(),
        },
      };
    } catch (error) {
      console.error("Weather insight error:", error);
      return {
        success: false,
        error: "Failed to get weather insight",
        data: {
          insight: "Enjoy your day! ☀️",
        },
      };
    }
  });
}
