// ─────────────────────────────────────────────────────────────
// Workspace Diff Types
// ─────────────────────────────────────────────────────────────

export interface WorkspaceDiffResponse {
  id: string;
  workspaceId: string;
  runId: string | null;
  baseRef: string | null;
  diffText: string;
  files: string[] | null;
  stats: { shortstat: string; files: number } | null;
  createdAt: Date;
}

export type WorkspaceDiffSummaryResponse = Omit<
  WorkspaceDiffResponse,
  "diffText"
>;

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
