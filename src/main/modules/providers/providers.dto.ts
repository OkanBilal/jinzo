// ─────────────────────────────────────────────────────────────
// Provider DTOs
// ─────────────────────────────────────────────────────────────

export type ProviderKind = "llm_runtime" | "agent_runtime";

export interface ProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  [key: string]: unknown;
}

export interface ProviderCapabilities {
  streaming?: boolean;
  functionCalling?: boolean;
  vision?: boolean;
  embeddings?: boolean;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// Create / Update Payloads
// ─────────────────────────────────────────────────────────────
export interface CreateProviderPayload {
  id: string;
  kind: ProviderKind;
  displayName: string;
  isEnabled?: boolean;
  config?: ProviderConfig;
  capabilities?: ProviderCapabilities;
  defaultModel?: string;
}

export interface UpdateProviderPayload {
  displayName?: string;
  isEnabled?: boolean;
  config?: ProviderConfig;
  capabilities?: ProviderCapabilities;
  defaultModel?: string;
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────
export interface ProviderResponse {
  id: string;
  kind: ProviderKind;
  displayName: string;
  isEnabled: boolean;
  config: ProviderConfig | null;
  capabilities: ProviderCapabilities | null;
  defaultModel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderListResponse {
  providers: ProviderResponse[];
  total: number;
}

// ─────────────────────────────────────────────────────────────
// Service Response
// ─────────────────────────────────────────────────────────────
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// CLI Detection
// ─────────────────────────────────────────────────────────────
export interface DetectedClisResponse {
  claude: boolean;
  copilot: boolean;
  codex: boolean;
  cursor: boolean;
}
