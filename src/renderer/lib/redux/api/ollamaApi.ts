import { baseApi } from "./baseApi";

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaModelsResponse {
  models: string[];
}

export const ollamaApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOllamaModels: builder.query<OllamaModelsResponse, void>({
      query: () => ({
        handler: 'ollama:getModels',
        args: [],
      }),
      transformResponse: (response: any) => response.success ? response.data : { models: [] },
      providesTags: ["Models", "Ollama"],
    }),

    checkOllamaStatus: builder.query<
      { status: string; version?: string },
      void
    >({
      query: () => ({
        handler: 'ollama:checkStatus',
        args: [],
      }),
      transformResponse: (response: any) => response.success ? response.data : { status: 'error' },
      providesTags: ["Ollama"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetOllamaModelsQuery, useCheckOllamaStatusQuery } = ollamaApi;
