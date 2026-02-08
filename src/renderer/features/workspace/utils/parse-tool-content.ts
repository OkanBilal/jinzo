export function parseToolContent(content: string): {
  toolName: string;
  params: Record<string, unknown> | null;
  summary: string;
} {
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
    } else {
      summary = `(${Object.keys(params).length} params)`;
    }
    return { toolName, params, summary };
  } catch {
    const summary = rest.length > 60 ? rest.substring(0, 60) + "..." : rest;
    return { toolName, params: null, summary };
  }
}
