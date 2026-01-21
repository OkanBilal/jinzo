import { ipcMain } from "electron";
import type { OllamaShowResponse, ShowApiResponse, WeatherInsightRequest } from "./types";
import {
  getTagsUrl,
  getShowUrl,
  getOllamaHost,
  getEmbeddingRegex,
  processModels,
  determineThinkingSupport,
  getWeatherCondition,
  cleanThinkingTags,
} from "./utils";

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
      insight = cleanThinkingTags(insight);

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

  console.log("Ollama handlers registered");
}

export function unregisterOllamaHandlers() {
  ipcMain.removeHandler("ollama:getModels");
  ipcMain.removeHandler("ollama:showModel");
  ipcMain.removeHandler("ollama:getWeatherInsight");
}
