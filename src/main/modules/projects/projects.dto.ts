// ─────────────────────────────────────────────────────────────
// Project DTOs
// ─────────────────────────────────────────────────────────────

export interface ProjectResponse {
  id: string;
  accountId: string;
  name: string;
  rootPath: string;
  workspacesPath: string | null;
  branches: string[] | null;
  remoteOrigin: string;
  defaultBranch: string | null;
  setupScript: string | null;
  runScript: string | null;
  archiveScript: string | null;
  icon: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectPayload {
  id?: string;
  accountId: string;
  name: string;
  rootPath: string;
  remoteOrigin: string;
  workspacesPath?: string;
  branches?: string[];
  defaultBranch?: string;
  setupScript?: string;
  runScript?: string;
  archiveScript?: string;
  icon?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  rootPath?: string;
  workspacesPath?: string;
  branches?: string[];
  remoteOrigin?: string;
  defaultBranch?: string;
  setupScript?: string;
  runScript?: string;
  archiveScript?: string;
  icon?: string | null;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
