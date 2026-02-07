import {
  getTagsUrl,
  getShowUrl,
  getEmbeddingRegex,
  processModels,
  determineThinkingSupport,
} from "./ollama.helpers";
import type {
  OllamaShowResponse,
  ShowApiResponse,
  ModelsResponse,
  ServiceResponse,
} from "./ollama.dto";

export const ollamaService = {
  async getModels(): Promise<ServiceResponse<ModelsResponse>> {
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
  },

  async showModel(modelName: string): Promise<ServiceResponse<ShowApiResponse>> {
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
  },


};
