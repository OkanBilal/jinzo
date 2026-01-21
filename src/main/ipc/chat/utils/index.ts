export { buildJsonSchema } from "./schema";
export { sendStreamChunk, sendStreamFinal, sendStreamError } from "./streaming";
export {
  shouldUseStructuredOutput,
  getStructuredSchema,
  buildStructuredSystemPrompt,
} from "./structured-output";
export { mergeOptionsWithConfig, type MergedChatOptions } from "./options";
