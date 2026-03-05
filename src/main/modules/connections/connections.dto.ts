// ─────────────────────────────────────────────────────────────
// Resource Types
// ─────────────────────────────────────────────────────────────
export interface GithubRepo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string | null;
}

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  private: boolean;
  updatedAt: string | null;
  url?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrl: string | null;
  description: string | null;
  isPrivate: boolean;
  url?: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  archived: boolean;
  color: string | null;
  workspaceGid: string;
  workspaceName: string;
  teamGid?: string | null;
  teamName?: string | null;
  modifiedAt: string | null;
  public: boolean;
  url?: string;
}

export interface GitlabProject {
  id: number;
  name: string;
  pathWithNamespace: string;
  webUrl: string;
  description: string | null;
  visibility: string;
  lastActivityAt: string | null;
  stars: number;
  forks: number;
  defaultBranch: string | null;
  private: boolean;
  url?: string;
}

export interface ConnectionResource {
  id: string;
  connectionId: string;
  externalId: string;
  kind: string;
  name: string;
  url?: string | null;
  selected: boolean;
  metadata: string | null;
  lastSeenAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Payload Types
// ─────────────────────────────────────────────────────────────
export interface SaveResourcesPayload {
  provider: string;
  connectionId: string;
  resources?: unknown[];
  sources?: string[];
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type ServiceResponse<T> = SuccessResponse<T> | ErrorResponse;
