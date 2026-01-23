// ─────────────────────────────────────────────────────────────
// Copilot DTOs
// ─────────────────────────────────────────────────────────────
export interface CopilotChatPayload {
  prompt: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
