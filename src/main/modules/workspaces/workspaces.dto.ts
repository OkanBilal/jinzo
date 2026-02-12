// ─────────────────────────────────────────────────────────────
// Workspace DTOs
// ─────────────────────────────────────────────────────────────

/**
 * Worktree-specific metadata when workspace was imported via worktree
 */
export interface WorktreeMetadata {
  enabled: true;
  name: string;
  path: string;
  sourcePath: string;
  branch: string;
}

/**
 * Origin remote metadata
 */
export interface OriginMetadata {
  url: string | null;
}

/**
 * Workspace metadata - preserves existing fields and extends for worktree flow
 *
 * Top-level fields (existing, must remain compatible):
 * - isGitRepo: boolean - whether this is a git repository
 * - tracking: string | null - upstream tracking branch (e.g., "origin/main")
 * - ahead: number - commits ahead of tracking branch
 * - behind: number - commits behind tracking branch
 *
 * New optional fields for worktree imports:
 * - worktree: WorktreeMetadata - worktree configuration if imported via worktree
 * - origin: OriginMetadata - origin remote info
 * - baseBranch: string - branch that was active before creating import branch
 */
export interface WorkspaceMetadata {
  // Existing top-level fields (MUST remain for compatibility)
  isGitRepo?: boolean;
  tracking?: string | null;
  ahead?: number;
  behind?: number;

  // New optional fields for worktree imports
  worktree?: WorktreeMetadata;
  origin?: OriginMetadata;
  baseBranch?: string;

  // Legacy fields
  language?: string;
  framework?: string;
  packageManager?: string;

  // Allow additional fields
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
  isArchived: boolean;
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
