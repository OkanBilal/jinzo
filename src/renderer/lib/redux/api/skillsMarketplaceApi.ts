import { unwrap, type ServiceResponse } from "../../../../shared/ipc-kit/service-response";
import { baseApi } from "./baseApi";

// ─────────────────────────────────────────────────────────────
// skills.sh API types — mirror src/main/modules/skillsMarketplace/skillsMarketplace.dto.ts
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
  [k: string]: unknown;
}

export interface SkillListResponse {
  skills: SkillSummary[];
  page?: number;
  perPage?: number;
  total?: number;
  view?: SkillView;
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

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────

export const skillsMarketplaceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMarketplaceSkills: builder.query<SkillListResponse, ListArgs | void>({
      query: (args) => ({
        handler: "skillsMarketplace:list",
        args: [args ?? {}],
      }),
      transformResponse: (response: ServiceResponse<SkillListResponse>) => unwrap(response),
      providesTags: (_r, _e, args) => [
        {
          type: "SkillsMarketplace",
          id: `list:${args?.view ?? "default"}:${args?.page ?? 1}:${args?.perPage ?? ""}`,
        },
      ],
    }),

    searchMarketplaceSkills: builder.query<SkillSearchResponse, SearchArgs>({
      query: (args) => ({
        handler: "skillsMarketplace:search",
        args: [args],
      }),
      transformResponse: (response: ServiceResponse<SkillSearchResponse>) => unwrap(response),
      providesTags: (_r, _e, args) => [
        { type: "SkillsMarketplace", id: `search:${args.q}:${args.limit ?? ""}` },
      ],
    }),

    getCuratedSkills: builder.query<CuratedResponse, void>({
      query: () => ({ handler: "skillsMarketplace:curated" }),
      transformResponse: (response: ServiceResponse<CuratedResponse>) => unwrap(response),
      providesTags: [{ type: "SkillsMarketplace", id: "curated" }],
    }),

    getMarketplaceSkillDetail: builder.query<SkillDetailResponse, SkillRef>({
      query: (ref) => ({
        handler: "skillsMarketplace:detail",
        args: [ref],
      }),
      transformResponse: (response: ServiceResponse<SkillDetailResponse>) => unwrap(response),
      providesTags: (_r, _e, ref) => [
        { type: "SkillsMarketplace", id: `detail:${ref.source}/${ref.skill}` },
      ],
    }),

    getMarketplaceSkillAudit: builder.query<SkillAuditResponse, SkillRef>({
      query: (ref) => ({
        handler: "skillsMarketplace:audit",
        args: [ref],
      }),
      transformResponse: (response: ServiceResponse<SkillAuditResponse>) => unwrap(response),
      providesTags: (_r, _e, ref) => [
        { type: "SkillsMarketplace", id: `audit:${ref.source}/${ref.skill}` },
      ],
    }),
  }),
});

export const {
  useListMarketplaceSkillsQuery,
  useLazyListMarketplaceSkillsQuery,
  useSearchMarketplaceSkillsQuery,
  useLazySearchMarketplaceSkillsQuery,
  useGetCuratedSkillsQuery,
  useGetMarketplaceSkillDetailQuery,
  useGetMarketplaceSkillAuditQuery,
} = skillsMarketplaceApi;
