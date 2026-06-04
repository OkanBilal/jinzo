// Workspace aggregate API — see ADR-0001.
// Consolidates: workspacesApi + workspaceActivityApi + workspaceDiffsApi
// + reviewsApi + reviewFindingsApi.
//
// Tag types stay split (Workspaces, WorkspaceActivity, WorkspaceDiffs,
// Reviews, ReviewFindings) so UI sections refresh independently.

import { unwrap, type ServiceResponse } from "../../../../shared/ipc-kit/service-response";
import { baseApi } from "./baseApi";
import { CHANNELS } from "../../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// ── Workspace ──
// ─────────────────────────────────────────────────────────────

export interface WorkspaceMetadata {
  language?: string;
  framework?: string;
  packageManager?: string;
  [key: string]: unknown;
}

export type WorkspaceStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "canceled"
  | "duplicate";

export interface Workspace {
  id: string;
  accountId: string;
  projectId: string | null;
  name: string;
  rootPath: string;
  repoUrl: string | null;
  defaultBranch: string | null;
  metadata: WorkspaceMetadata | null;
  status: WorkspaceStatus;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkspacePayload {
  id: string;
  accountId: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  defaultBranch?: string;
  metadata?: WorkspaceMetadata;
  projectId?: string;
}

export interface UpdateWorkspacePayload {
  name?: string;
  rootPath?: string;
  repoUrl?: string;
  defaultBranch?: string;
  metadata?: WorkspaceMetadata;
  status?: WorkspaceStatus;
}

// Workspace intake — one operation creates a project + workspace from a repo.
// The worktree-vs-direct branching and project find-or-create live in the
// main process (workspaceService.createFromSource). See CONTEXT.md.
export type WorkspaceIntakeSource =
  | { kind: "folder"; path: string }
  | { kind: "clone"; url: string; targetPath: string }
  | { kind: "init"; name: string };

export interface WorkspaceIntakePayload {
  accountId: string;
  source: WorkspaceIntakeSource;
}

// ─────────────────────────────────────────────────────────────
// ── Activity ──
// ─────────────────────────────────────────────────────────────

export type ActivityType = "diff" | "review" | "finding" | "commit" | "pr";

export interface WorkspaceActivity {
  id: string;
  workspaceId: string;
  type: ActivityType;
  title: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  refId: string | null;
  createdAt: number;
}

export interface CreateWorkspaceActivityPayload {
  workspaceId: string;
  type: ActivityType;
  title: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  refId?: string;
}

// ─────────────────────────────────────────────────────────────
// ── Diffs ──
// ─────────────────────────────────────────────────────────────

export interface WorkspaceDiff {
  id: string;
  workspaceId: string;
  runId: string | null;
  baseRef: string | null;
  diffText: string;
  files: string[] | null;
  stats: { shortstat: string; files: number } | null;
  createdAt: number;
}

export type WorkspaceDiffSummary = Omit<WorkspaceDiff, "diffText">;

// ─────────────────────────────────────────────────────────────
// ── Reviews ──
// ─────────────────────────────────────────────────────────────

export type ReviewStatus = "open" | "in_review" | "approved" | "rejected";

export interface Review {
  id: string;
  workspaceId: string | null;
  title: string;
  summary: string | null;
  status: ReviewStatus;
  runId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateReviewPayload {
  id?: string;
  workspaceId?: string;
  title: string;
  summary?: string;
  status?: ReviewStatus;
  runId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateReviewPayload {
  title?: string;
  summary?: string;
  status?: ReviewStatus;
  runId?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// ── Findings ──
// ─────────────────────────────────────────────────────────────

export type FindingSeverity = "critical" | "warning" | "info";

export interface ReviewFinding {
  id: string;
  reviewId: string;
  severity: FindingSeverity;
  file: string;
  lineStart: number | null;
  lineEnd: number | null;
  message: string;
  reason: string;
  suggestion: string | null;
  validated: boolean;
  isApproved: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

export interface CreateReviewFindingPayload {
  id?: string;
  reviewId: string;
  severity: FindingSeverity;
  file: string;
  lineStart?: number;
  lineEnd?: number;
  message: string;
  reason: string;
  suggestion?: string;
  validated?: boolean;
  isApproved?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateReviewFindingPayload {
  severity?: FindingSeverity;
  file?: string;
  lineStart?: number | null;
  lineEnd?: number | null;
  message?: string;
  reason?: string;
  suggestion?: string | null;
  validated?: boolean;
  isApproved?: boolean;
  metadata?: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────────────────────

export const workspaceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Workspace lifecycle ──
    listWorkspaces: builder.query<Workspace[], void>({
      query: () => ({ handler: CHANNELS.workspace.list }),
      transformResponse: (response: ServiceResponse<Workspace[]>) =>
        unwrap(response),
      providesTags: ["Workspaces"],
    }),

    getWorkspace: builder.query<Workspace, string>({
      query: (id) => ({
        handler: CHANNELS.workspace.get,
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<Workspace>) =>
        unwrap(response),
      providesTags: (_result, _error, id) => [{ type: "Workspaces", id }],
    }),

    listWorkspacesByAccount: builder.query<Workspace[], string>({
      query: (accountId) => ({
        handler: CHANNELS.workspace.listByAccount,
        args: [accountId],
      }),
      transformResponse: (response: ServiceResponse<Workspace[]>) =>
        unwrap(response),
      providesTags: ["Workspaces"],
    }),

    getWorkspaceByRootPath: builder.query<
      Workspace,
      { accountId: string; rootPath: string }
    >({
      query: ({ accountId, rootPath }) => ({
        handler: CHANNELS.workspace.getByRootPath,
        args: [accountId, rootPath],
      }),
      transformResponse: (response: ServiceResponse<Workspace>) =>
        unwrap(response),
      providesTags: ["Workspaces"],
    }),

    createWorkspace: builder.mutation<string, CreateWorkspacePayload>({
      query: (payload) => ({
        handler: CHANNELS.workspace.create,
        args: [payload],
      }),
      transformResponse: (response: ServiceResponse<string>) =>
        unwrap(response),
      invalidatesTags: ["Workspaces"],
    }),

    // Create a project + workspace from a repo (picked folder / clone / init).
    // Returns the created workspace so callers can navigate to it.
    createWorkspaceFromSource: builder.mutation<Workspace, WorkspaceIntakePayload>({
      query: (payload) => ({
        handler: CHANNELS.workspace.createFromSource,
        args: [payload],
      }),
      transformResponse: (response: ServiceResponse<Workspace>) =>
        unwrap(response),
      invalidatesTags: ["Workspaces", "Projects"],
    }),

    updateWorkspace: builder.mutation<
      Workspace,
      { id: string; payload: UpdateWorkspacePayload }
    >({
      query: ({ id, payload }) => ({
        handler: CHANNELS.workspace.update,
        args: [id, payload],
      }),
      transformResponse: (response: ServiceResponse<Workspace>) =>
        unwrap(response),
      invalidatesTags: (_result, _error, { id }) => [
        "Workspaces",
        { type: "Workspaces", id },
      ],
    }),

    deleteWorkspace: builder.mutation<void, string>({
      query: (id) => ({
        handler: CHANNELS.workspace.delete,
        args: [id],
      }),
      invalidatesTags: ["Workspaces"],
    }),

    archiveWorkspace: builder.mutation<Workspace, string>({
      query: (id) => ({
        handler: CHANNELS.workspace.archive,
        args: [id],
      }),
      transformResponse: (response: ServiceResponse<Workspace>) =>
        unwrap(response),
      invalidatesTags: (_result, _error, id) => [
        "Workspaces",
        { type: "Workspaces", id },
      ],
    }),

    selectWorkspaceDirectory: builder.mutation<string | null, void>({
      query: () => ({ handler: CHANNELS.workspace.selectDirectory }),
      transformResponse: (response: ServiceResponse<string | null>) =>
        unwrap(response),
    }),

    // ── Activity ──
    listWorkspaceActivity: builder.query<
      WorkspaceActivity[],
      { workspaceId: string; limit?: number }
    >({
      query: ({ workspaceId, limit }) => ({
        handler: CHANNELS.workspace.listActivity,
        args: [workspaceId, limit],
      }),
      transformResponse: (response: any) => response?.data ?? [],
      keepUnusedDataFor: 30,
      providesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceActivity", id: workspaceId },
      ],
    }),

    createWorkspaceActivity: builder.mutation<
      string,
      CreateWorkspaceActivityPayload
    >({
      query: (payload) => ({
        handler: CHANNELS.workspace.createActivity,
        args: [payload],
      }),
      transformResponse: (response: any) => response?.data,
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceActivity", id: workspaceId },
      ],
    }),

    deleteWorkspaceActivity: builder.mutation<
      void,
      { id: string; workspaceId: string }
    >({
      query: ({ id }) => ({
        handler: CHANNELS.workspace.deleteActivity,
        args: [id],
      }),
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceActivity", id: workspaceId },
      ],
    }),

    // ── Diffs ──
    // Note: getLatest* use queryFn rather than `query` so we can return
    // null on error (diffs are often legitimately absent — no error UI needed).
    getLatestWorkspaceDiff: builder.query<WorkspaceDiff | null, string>({
      queryFn: async (workspaceId) => {
        const result = await window.api.workspace.getLatestDiff(workspaceId);
        return { data: result.success ? (result.data ?? null) : null };
      },
      // Diff text can be huge; drop it quickly when no subscribers remain.
      keepUnusedDataFor: 15,
      providesTags: (_result, _error, workspaceId) => [
        { type: "WorkspaceDiffs", id: workspaceId },
      ],
    }),

    getLatestWorkspaceDiffSummary: builder.query<
      WorkspaceDiffSummary | null,
      string
    >({
      queryFn: async (workspaceId) => {
        const result =
          await window.api.workspace.getLatestDiffSummary(workspaceId);
        return { data: result.success ? (result.data ?? null) : null };
      },
      keepUnusedDataFor: 60,
      providesTags: (_result, _error, workspaceId) => [
        { type: "WorkspaceDiffs", id: workspaceId },
      ],
    }),

    listWorkspaceDiffs: builder.query<
      WorkspaceDiff[],
      { workspaceId: string; limit?: number }
    >({
      query: ({ workspaceId, limit }) => ({
        handler: CHANNELS.workspace.listDiffs,
        args: [workspaceId, limit],
      }),
      transformResponse: (response: ServiceResponse<WorkspaceDiff[]>) =>
        unwrap(response),
      keepUnusedDataFor: 15,
      providesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceDiffs", id: workspaceId },
      ],
    }),

    // Manual diff refresh — recomputes the workspace's diff against its
    // baseRef (or HEAD) and reconciles the latest diff row. Returns the
    // updated summary, or null when the working tree is clean.
    resyncWorkspaceDiff: builder.mutation<WorkspaceDiffSummary | null, string>({
      query: (workspaceId) => ({
        handler: CHANNELS.workspace.resyncDiff,
        args: [workspaceId],
      }),
      transformResponse: (
        response: ServiceResponse<WorkspaceDiffSummary | null>,
      ) => unwrap(response),
      invalidatesTags: (_result, _error, workspaceId) => [
        { type: "WorkspaceDiffs", id: workspaceId },
      ],
    }),

    // ── Reviews ──
    listReviewsByWorkspace: builder.query<
      Review[],
      { workspaceId: string; limit?: number }
    >({
      query: ({ workspaceId, limit }) => ({
        handler: CHANNELS.workspace.listReviews,
        args: [workspaceId, limit],
      }),
      transformResponse: (response: any) => response?.data ?? [],
      providesTags: ["Reviews"],
    }),

    getReview: builder.query<Review, string>({
      query: (id) => ({
        handler: CHANNELS.workspace.getReview,
        args: [id],
      }),
      transformResponse: (response: any) => response?.data ?? null,
      providesTags: (_result, _err, id) => [{ type: "Reviews", id }],
    }),

    createReview: builder.mutation<string, CreateReviewPayload>({
      query: (payload) => ({
        handler: CHANNELS.workspace.createReview,
        args: [payload],
      }),
      transformResponse: (response: any) => response?.data,
      invalidatesTags: ["Reviews"],
    }),

    updateReview: builder.mutation<
      Review,
      { id: string; payload: UpdateReviewPayload }
    >({
      query: ({ id, payload }) => ({
        handler: CHANNELS.workspace.updateReview,
        args: [id, payload],
      }),
      transformResponse: (response: any) => response?.data,
      invalidatesTags: (_result, _err, { id }) => [
        "Reviews",
        { type: "Reviews", id },
      ],
    }),

    deleteReview: builder.mutation<void, string>({
      query: (id) => ({
        handler: CHANNELS.workspace.deleteReview,
        args: [id],
      }),
      invalidatesTags: ["Reviews"],
    }),

    // ── Findings ──
    listReviewFindingsByWorkspace: builder.query<
      ReviewFinding[],
      { workspaceId: string }
    >({
      query: ({ workspaceId }) => ({
        handler: CHANNELS.workspace.listFindingsByWorkspace,
        args: [workspaceId],
      }),
      transformResponse: (response: any) => response?.data ?? [],
      providesTags: ["ReviewFindings"],
    }),

    listReviewFindingsByReview: builder.query<
      ReviewFinding[],
      { reviewId: string; limit?: number }
    >({
      query: ({ reviewId, limit }) => ({
        handler: CHANNELS.workspace.listFindings,
        args: [reviewId, limit],
      }),
      transformResponse: (response: any) => response?.data ?? [],
      providesTags: ["ReviewFindings"],
    }),

    getReviewFinding: builder.query<ReviewFinding, string>({
      query: (id) => ({
        handler: CHANNELS.workspace.getFinding,
        args: [id],
      }),
      transformResponse: (response: any) => response?.data ?? null,
      providesTags: (_result, _err, id) => [{ type: "ReviewFindings", id }],
    }),

    createReviewFinding: builder.mutation<string, CreateReviewFindingPayload>({
      query: (payload) => ({
        handler: CHANNELS.workspace.createFinding,
        args: [payload],
      }),
      transformResponse: (response: any) => response?.data,
      invalidatesTags: ["ReviewFindings"],
    }),

    createReviewFindings: builder.mutation<
      string[],
      CreateReviewFindingPayload[]
    >({
      query: (payloads) => ({
        handler: CHANNELS.workspace.createManyFindings,
        args: [payloads],
      }),
      transformResponse: (response: any) => response?.data,
      invalidatesTags: ["ReviewFindings"],
    }),

    updateReviewFinding: builder.mutation<
      ReviewFinding,
      { id: string; payload: UpdateReviewFindingPayload }
    >({
      query: ({ id, payload }) => ({
        handler: CHANNELS.workspace.updateFinding,
        args: [id, payload],
      }),
      transformResponse: (response: any) => response?.data,
      invalidatesTags: (_result, _err, { id }) => [
        "ReviewFindings",
        { type: "ReviewFindings", id },
      ],
    }),

    deleteReviewFinding: builder.mutation<void, string>({
      query: (id) => ({
        handler: CHANNELS.workspace.deleteFinding,
        args: [id],
      }),
      invalidatesTags: ["ReviewFindings"],
    }),
  }),
});

export const {
  // workspace lifecycle
  useListWorkspacesQuery,
  useLazyListWorkspacesQuery,
  useGetWorkspaceQuery,
  useLazyGetWorkspaceQuery,
  useListWorkspacesByAccountQuery,
  useLazyListWorkspacesByAccountQuery,
  useGetWorkspaceByRootPathQuery,
  useLazyGetWorkspaceByRootPathQuery,
  useCreateWorkspaceMutation,
  useCreateWorkspaceFromSourceMutation,
  useUpdateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useArchiveWorkspaceMutation,
  useSelectWorkspaceDirectoryMutation,
  // activity
  useListWorkspaceActivityQuery,
  useCreateWorkspaceActivityMutation,
  useDeleteWorkspaceActivityMutation,
  // diffs
  useGetLatestWorkspaceDiffQuery,
  useLazyGetLatestWorkspaceDiffQuery,
  useGetLatestWorkspaceDiffSummaryQuery,
  useLazyGetLatestWorkspaceDiffSummaryQuery,
  useListWorkspaceDiffsQuery,
  useLazyListWorkspaceDiffsQuery,
  useResyncWorkspaceDiffMutation,
  // reviews
  useListReviewsByWorkspaceQuery,
  useGetReviewQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
  // findings
  useListReviewFindingsByWorkspaceQuery,
  useListReviewFindingsByReviewQuery,
  useGetReviewFindingQuery,
  useCreateReviewFindingMutation,
  useCreateReviewFindingsMutation,
  useUpdateReviewFindingMutation,
  useDeleteReviewFindingMutation,
} = workspaceApi;
