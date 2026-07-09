/**
 * Tool outputs arrive either as structured objects or as that object JSON-
 * serialized into a string, depending on the provider adapter. Returns the
 * parsed value when the string is JSON, the original string when it isn't,
 * and null for empty output — so parsers can branch on shape, not encoding.
 */
export function coerceToolOutput(output: unknown): unknown {
  if (!output) return null;
  if (typeof output !== "string") return output;
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}

export interface ParsedToolContent {
  toolName: string;
  params: Record<string, unknown> | null;
  summary: string;
}

export function parseToolContent(content: string): ParsedToolContent {
  const colonIdx = content.indexOf(":");
  if (colonIdx === -1) {
    return { toolName: content, params: null, summary: content };
  }

  const toolName = content.substring(0, colonIdx).trim();
  const rest = content.substring(colonIdx + 1).trim();

  try {
    const params = JSON.parse(rest);
    let summary = "";
    if (params.file_path) {
      summary = params.file_path.split("/").pop() || params.file_path;
    } else if (params.command) {
      summary =
        params.command.length > 100
          ? params.command.substring(0, 100) + "..."
          : params.command;
    } else if (params.description) {
      summary = params.description;
    } else if (params.skill) {
      summary = params.skill;
    } else {
      const paramCount = Object.keys(params).length;
      summary = paramCount > 0 ? `(${paramCount} params)` : "";
    }
    return { toolName, params, summary };
  } catch {
    const summary = rest.length > 60 ? rest.substring(0, 60) + "..." : rest;
    return { toolName, params: null, summary };
  }
}
