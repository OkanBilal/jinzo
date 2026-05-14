// ─────────────────────────────────────────────────────────────
// Service Response (mirrors providers.dto.ts shape)
// ─────────────────────────────────────────────────────────────
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// skills.sh API types
// Reference: https://skills.sh/docs/api
// ─────────────────────────────────────────────────────────────

export type SkillView = "trending" | "hot" | "all-time";

export interface SkillSummary {
  id: string;
  source: string;
  slug: string;
  name: string;
  description?: string;
  installs?: number;
  installUrl?: string;
  homepage?: string;
  tags?: string[];
  owner?: { name?: string; avatarUrl?: string };
  updatedAt?: string;
  // Pass through unknown fields (skills.sh may add more later)
  [k: string]: unknown;
}

export interface SkillListResponse {
  skills: SkillSummary[];
  page?: number;
  perPage?: number;
  total?: number;
  view?: SkillView;
  // Pass through unknown fields
  [k: string]: unknown;
}

export interface SkillSearchResponse {
  results: SkillSummary[];
  query: string;
  [k: string]: unknown;
}

export interface CuratedGroup {
  owner: { id?: string; name: string; avatarUrl?: string };
  featured?: SkillSummary[];
  skills: SkillSummary[];
  [k: string]: unknown;
}

export interface CuratedResponse {
  groups: CuratedGroup[];
  [k: string]: unknown;
}

export interface SkillFile {
  path: string;
  size?: number;
  sha256?: string;
  content?: string;
}

export interface SkillDetailResponse {
  id: string;
  source: string;
  slug: string;
  name: string;
  description?: string;
  installs?: number;
  installUrl?: string;
  homepage?: string;
  readme?: string;
  files?: SkillFile[];
  sha256?: string;
  owner?: { name?: string; avatarUrl?: string };
  tags?: string[];
  updatedAt?: string;
  [k: string]: unknown;
}

export interface SkillAuditEntry {
  partner: string;
  status?: string;
  url?: string;
  summary?: string;
  [k: string]: unknown;
}

export interface SkillAuditResponse {
  audits: SkillAuditEntry[];
  [k: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// Controller args
// ─────────────────────────────────────────────────────────────

export interface ListArgs {
  view?: SkillView;
  page?: number;
  perPage?: number;
}

export interface SearchArgs {
  q: string;
  limit?: number;
}

export interface SkillRef {
  source: string;
  skill: string;
}
