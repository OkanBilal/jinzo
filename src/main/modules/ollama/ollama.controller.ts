import { ollamaService } from "./ollama.service";
import type {
  ModelsResponse,
  ShowApiResponse,
  WeatherInsightRequest,
  WeatherInsightResponse,
  ServiceResponse,
} from "./ollama.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const ollamaController = {
  async getModels(): Promise<ServiceResponse<ModelsResponse>> {
    return ollamaService.getModels();
  },

  async showModel(modelName: string): Promise<ServiceResponse<ShowApiResponse>> {
    return ollamaService.showModel(modelName);
  },

  async getWeatherInsight(
    payload: WeatherInsightRequest
  ): Promise<ServiceResponse<WeatherInsightResponse>> {
    return ollamaService.getWeatherInsight(payload);
  },
};
