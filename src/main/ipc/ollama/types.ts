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

export interface OllamaShowResponse {
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

export interface ShowApiResponse {
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

export interface WeatherInsightRequest {
  temperature: number;
  weatherCode: number;
  windspeed?: number;
  location: {
    lat: number;
    lon: number;
  };
}
