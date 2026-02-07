/**
 * Utilities for estimating token counts.
 * Uses a conservative estimate of ~4 characters per token for English text.
 * This is a rough approximation - actual tokenization varies by model.
 */

const CHARS_PER_TOKEN = 4;

/**
 * Estimate the number of tokens in a string.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a message (role + content).
 * Adds overhead for message structure.
 */
export function estimateMessageTokens(message: {
  role: string;
  content: string;
}): number {
  // Add ~4 tokens overhead for message structure (role, formatting)
  const overhead = 4;
  return estimateTokens(message.content) + overhead;
}

/**
 * Estimate total tokens for an array of messages.
 */
export function estimateTotalTokens(
  messages: Array<{ role: string; content: string }>,
): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

/**
 * Trim messages array from the front to fit within token budget.
 * Keeps the most recent messages (from the end of the array).
 * @returns The trimmed messages array
 */
export function trimMessagesToFitTokenBudget<
  T extends { role: string; content: string },
>(messages: T[], maxTokens: number): T[] {
  if (messages.length === 0) return [];

  let totalTokens = estimateTotalTokens(messages);

  // If already within budget, return as-is
  if (totalTokens <= maxTokens) {
    return messages;
  }

  // Remove messages from the front until we fit
  const result = [...messages];
  while (result.length > 0 && totalTokens > maxTokens) {
    const removed = result.shift();
    if (removed) {
      totalTokens -= estimateMessageTokens(removed);
    }
  }

  return result;
}

// Default token limits and reserved amounts
export const TOKEN_LIMITS = {
  /** Ollama's default context limit */
  OLLAMA_CONTEXT_LIMIT: 131072,
  /** Reserved tokens for system prompt */
  SYSTEM_PROMPT_RESERVE: 1000,
  /** Reserved tokens for model response */
  RESPONSE_RESERVE: 4000,
  /** Safety margin to avoid edge cases */
  SAFETY_MARGIN: 2000,
} as const;

/**
 * Calculate available token budget for conversation history.
 * @param systemPromptTokens Estimated tokens in system prompt
 * @param currentQuestionTokens Estimated tokens in current user question
 * @param contextLimit Total context limit (default: Ollama's 131072)
 */
export function calculateHistoryTokenBudget(
  systemPromptTokens: number,
  currentQuestionTokens: number,
  contextLimit: number = TOKEN_LIMITS.OLLAMA_CONTEXT_LIMIT,
): number {
  const reserved =
    systemPromptTokens +
    currentQuestionTokens +
    TOKEN_LIMITS.RESPONSE_RESERVE +
    TOKEN_LIMITS.SAFETY_MARGIN;

  return Math.max(0, contextLimit - reserved);
}
