import { ollamaService } from "./ollama.service";
import type {
  ModelsResponse,
  ShowApiResponse,
  ServiceResponse,
} from "./ollama.dto";

export const ollamaController = {
  async getModels(): Promise<ServiceResponse<ModelsResponse>> {
    return ollamaService.getModels();
  },

  async showModel(modelName: string): Promise<ServiceResponse<ShowApiResponse>> {
    return ollamaService.showModel(modelName);
  },

};
