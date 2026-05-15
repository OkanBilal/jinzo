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
  remoteOrigin: string | null;
  defaultBranch: string | null;
  setupScript: string | null;
  runScript: string | null;
  archiveScript: string | null;
  icon: string | null;
  commitInstructions: string | null;
  prInstructions: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectPayload {
  id?: string;
  accountId: string;
  name: string;
  rootPath: string;
  remoteOrigin?: string | null;
  workspacesPath?: string;
  branches?: string[];
  defaultBranch?: string;
  setupScript?: string;
  runScript?: string;
  archiveScript?: string;
  icon?: string;
  commitInstructions?: string;
  prInstructions?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  rootPath?: string;
  workspacesPath?: string;
  branches?: string[];
  remoteOrigin?: string | null;
  defaultBranch?: string;
  setupScript?: string;
  runScript?: string;
  archiveScript?: string;
  icon?: string | null;
  commitInstructions?: string;
  prInstructions?: string;
}

export type { ServiceResponse } from "../../../shared/ipc-kit/service-response";
