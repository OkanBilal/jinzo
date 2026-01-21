import { ValidationResult } from "@/lib/chat/types";
import { ChatRequestBody } from "../types";
import { DEFAULT_MODEL } from "../config";





export function validateChatRequest(body: ChatRequestBody): ValidationResult {
  if (!body.question) {
    return {
      valid: false,
      error: "Missing 'question' field",
      statusCode: 400,
    };
  }

  if (typeof body.question !== "string") {
    return {
      valid: false,
      error: "'question' must be a string",
      statusCode: 400,
    };
  }

  const trimmedQuestion = body.question.trim();
  if (trimmedQuestion.length < 1) {
    return {
      valid: false,
      error: "Question is too short",
      statusCode: 400,
    };
  }

  if (body.model && typeof body.model !== "string") {
    return {
      valid: false,
      error: "'model' must be a string",
      statusCode: 400,
    };
  }

  if (body.sessionId !== undefined && typeof body.sessionId !== "number") {
    return {
      valid: false,
      error: "'sessionId' must be a number",
      statusCode: 400,
    };
  }

  if (body.options !== undefined && typeof body.options !== "object") {
    return {
      valid: false,
      error: "'options' must be an object",
      statusCode: 400,
    };
  }

  if (body.options?.mode && !["chat", "rag", "mcp"].includes(body.options.mode)) {
    return {
      valid: false,
      error: "'mode' must be 'chat', 'rag', or 'mcp'",
      statusCode: 400,
    };
  }

  return { valid: true };
}

export function normalizeChatRequest(body: ChatRequestBody): Required<
  Pick<ChatRequestBody, "question" | "model" | "options">
> & {
  sessionId: number;
} {
  return {
    question: body.question.trim(),
    model: body.model || DEFAULT_MODEL,
    sessionId: body.sessionId!,
    options: body.options || {},
  };
}
