// IPC
export { registerOllamaIpc, unregisterOllamaIpc } from "./ollama.ipc";

// Controller
export { ollamaController } from "./ollama.controller";

// Service
export { ollamaService } from "./ollama.service";

// Helpers
export {
  getOllamaHost,
  getTagsUrl,
  getShowUrl,
  getGenerateUrl,
  getEmbeddingRegex,
  getModelFamilies,
  isEmbeddingModel,
  processModels,
  determineThinkingSupport,
  getWeatherCondition,
  cleanThinkingTags,
} from "./ollama.helpers";

// DTOs
export type {
  OllamaModel,
  OllamaModelDetails,
  OllamaShowResponse,
  ShowApiResponse,
  ModelsResponse,
  WeatherInsightRequest,
  WeatherInsightResponse,
  ServiceResponse,
  SuccessResponse,
  ErrorResponse,
} from "./ollama.dto";
