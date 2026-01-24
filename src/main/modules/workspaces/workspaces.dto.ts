// ─────────────────────────────────────────────────────────────
// Workspace DTOs
// ─────────────────────────────────────────────────────────────

export interface WorkspaceMetadata {
  language?: string;
  framework?: string;
  packageManager?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// Create / Update Payloads
// ─────────────────────────────────────────────────────────────
export interface CreateWorkspacePayload {
  id?: string;
  accountId: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  defaultBranch?: string;
  metadata?: WorkspaceMetadata;
}

export interface UpdateWorkspacePayload {
  name?: string;
  rootPath?: string;
  repoUrl?: string;
  defaultBranch?: string;
  metadata?: WorkspaceMetadata;
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────
export interface WorkspaceResponse {
  id: string;
  accountId: string;
  name: string;
  rootPath: string;
  repoUrl: string | null;
  defaultBranch: string | null;
  metadata: WorkspaceMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceListResponse {
  workspaces: WorkspaceResponse[];
  total: number;
}

// ─────────────────────────────────────────────────────────────
// Service Response
// ─────────────────────────────────────────────────────────────
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
