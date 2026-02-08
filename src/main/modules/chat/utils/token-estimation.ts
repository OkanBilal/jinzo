/**
 * Utilities for estimating token counts.
 * Uses content-aware heuristics for better accuracy across different text types.
 */

const BASE_CHARS_PER_TOKEN = 4;

// Patterns that indicate content with different token densities
const CODE_PATTERN = /[{}\[\]();=<>|&!+\-*/\\^~`]/g;
const URL_PATTERN = /https?:\/\/\S+/g;
const WHITESPACE_HEAVY_PATTERN = /\s{2,}/g;

/**
 * Estimate the number of tokens in a string.
 * Uses content-aware heuristics: code-heavy text has more tokens per char
 * due to special characters being individual tokens; URLs are token-dense.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const length = text.length;

  // Count URL characters (URLs tokenize at ~1 token per 3 chars)
  const urls = text.match(URL_PATTERN);
  const urlChars = urls ? urls.reduce((sum, u) => sum + u.length, 0) : 0;

  // Count code-like special characters (each roughly 1 token)
  const codeChars = (text.match(CODE_PATTERN) || []).length;

  // Excess whitespace collapses into fewer tokens
  const excessWhitespace = (text.match(WHITESPACE_HEAVY_PATTERN) || [])
    .reduce((sum, m) => sum + m.length - 1, 0);

  const regularChars = length - urlChars - codeChars - excessWhitespace;

  const tokens =
    Math.ceil(regularChars / BASE_CHARS_PER_TOKEN) +
    Math.ceil(urlChars / 3) +
    codeChars +
    Math.ceil(excessWhitespace / 8);

  return tokens;
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
