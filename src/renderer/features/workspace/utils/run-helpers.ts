import type { UploadedFile } from "@/components/ui/input/file-upload-dropdown";

export interface SerializedAttachment {
  name: string;
  type: string;
  data: string;
  mimeType: string;
}

/** Convert UploadedFile[] to base64-encoded attachments for IPC transport */
export function serializeAttachments(files: UploadedFile[]): Promise<SerializedAttachment[]> {
  return Promise.all(
    files.map(
      (f) =>
        new Promise<SerializedAttachment>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(",")[1] || "";
            resolve({
              name: f.file.name,
              type: f.type,
              data: base64,
              mimeType: f.file.type || "application/octet-stream",
            });
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(f.file);
        }),
    ),
  );
}

/** Prepend context files and issues to the goal text */
export function buildGoalWithContext(
  goal: string,
  contextFiles: Array<{ fullPath: string }>,
  contextIssues: Array<{ provider: string; number?: number | null; title: string; body?: string | null }>,
): string {
  let finalGoal = goal;
  if (contextFiles.length > 0) {
    const filesList = contextFiles.map((f) => f.fullPath).join("\n");
    finalGoal = `Use these files as context:\n${filesList}\n\n${finalGoal}`;
  }
  if (contextIssues.length > 0) {
    const issuesList = contextIssues
      .map((i) => {
        const issueLabel = `[${i.provider.toUpperCase()}${i.number ? ` #${i.number}` : ""}] ${i.title}`;
        const issueBody = i.body ? `\n${i.body}` : "";
        return `${issueLabel}${issueBody}`;
      })
      .join("\n\n---\n\n");
    finalGoal = `Use these issues as context:\n\n${issuesList}\n\n${finalGoal}`;
  }
  return finalGoal;
}
