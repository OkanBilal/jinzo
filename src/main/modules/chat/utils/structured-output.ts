import type { ChatConfig, ChatOptions, StructuredOutputSchema } from "../chat.dto";
import { buildJsonSchema } from "./schema";

export function shouldUseStructuredOutput(
  options: ChatOptions,
  config: ChatConfig
): boolean {
  const enabled = options.structuredOutputEnabled ?? config.structuredOutputEnabled;
  const schema = options.structuredOutputSchema ?? config.structuredOutputSchema;
  return enabled && (schema?.properties?.length ?? 0) > 0;
}

export function getStructuredSchema(
  options: ChatOptions,
  config: ChatConfig
): StructuredOutputSchema | null {
  if (!shouldUseStructuredOutput(options, config)) return null;
  return options.structuredOutputSchema ?? config.structuredOutputSchema;
}

export function buildStructuredSystemPrompt(
  basePrompt: string,
  schema: StructuredOutputSchema
): string {
  const jsonSchema = buildJsonSchema(schema);
  return `${basePrompt}

You MUST respond ONLY with valid JSON matching this exact schema:
${JSON.stringify(jsonSchema, null, 2)}

Do not include any text outside the JSON object. Your entire response must be parseable JSON.`;
}
