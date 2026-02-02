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

export interface RaindropCollection {
  id: number;
  title: string;
  count: number;
  public: boolean;
  cover: string | null;
  color: string | null;
  created: string;
  lastUpdate: string;
}

export interface PodcastResource {
  name: string;
  uuid: string;
  imageUrl?: string;
  description?: string;
}

export interface RssFeed {
  name: string;
  url: string;
}

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  issueCount: number;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrl: string | null;
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
  lastIngestAt: Date | null;
}

// ─────────────────────────────────────────────────────────────
// Settings Types
// ─────────────────────────────────────────────────────────────
export interface HackerNewsSettings {
  topStories: boolean;
  userSubmissions: boolean;
  userComments: boolean;
}

// ─────────────────────────────────────────────────────────────
// Payload Types
// ─────────────────────────────────────────────────────────────
export interface HackerNewsTogglePayload {
  enabled: boolean;
  username?: string;
  topStories?: boolean;
  userSubmissions?: boolean;
  userComments?: boolean;
}

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
