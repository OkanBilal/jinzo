// Git Flow API — deterministic commit / push / PR operations driven from the
// git-actions panel (no chat agent). Mutations invalidate the workspace diff
// and activity caches so the Changes tab / activity feed refresh in place.

import { unwrap, type ServiceResponse } from "../../../../shared/ipc-kit/service-response";
import { baseApi } from "./baseApi";
import { CHANNELS } from "../../../../shared/ipc-kit/channels";

export interface GitFlowStatus {
  branch: string;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  isDefaultBranch: boolean;
}

export interface CommitResult {
  hash: string;
  summary: string;
  pushed: boolean;
}

export interface CommitGitFlowPayload {
  workspaceId: string;
  message?: string;
  includeUnstaged?: boolean;
  providerId?: string;
  model?: string;
  push?: boolean;
}

export interface CreatePrGitFlowPayload {
  workspaceId: string;
  title?: string;
  body?: string;
  base?: string;
  draft?: boolean;
  providerId?: string;
  model?: string;
}

export const gitFlowApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getGitFlowStatus: builder.query<GitFlowStatus | null, string>({
      query: (workspaceId) => ({
        handler: CHANNELS.gitFlow.getStatus,
        args: [workspaceId],
      }),
      transformResponse: (response: ServiceResponse<GitFlowStatus>) =>
        unwrap(response),
      keepUnusedDataFor: 30,
      // Intentionally untagged: this is the panel's own live read. Keeping it
      // off the WorkspaceDiffs tag stops the on-open resync (which refreshes
      // the sidebar) from triggering a redundant refetch here. The component
      // refetches this explicitly after commit/push instead.
    }),

    commitGitFlow: builder.mutation<CommitResult, CommitGitFlowPayload>({
      query: (payload) => ({
        handler: CHANNELS.gitFlow.commit,
        args: [payload],
      }),
      transformResponse: (response: ServiceResponse<CommitResult>) =>
        unwrap(response),
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceDiffs", id: workspaceId },
        { type: "WorkspaceActivity", id: workspaceId },
      ],
    }),

    pushGitFlow: builder.mutation<CommitResult, string>({
      query: (workspaceId) => ({
        handler: CHANNELS.gitFlow.push,
        args: [workspaceId],
      }),
      transformResponse: (response: ServiceResponse<CommitResult>) =>
        unwrap(response),
      invalidatesTags: (_result, _error, workspaceId) => [
        { type: "WorkspaceDiffs", id: workspaceId },
      ],
    }),

    createPrGitFlow: builder.mutation<{ url: string }, CreatePrGitFlowPayload>({
      query: (payload) => ({
        handler: CHANNELS.gitFlow.createPr,
        args: [payload],
      }),
      transformResponse: (response: ServiceResponse<{ url: string }>) =>
        unwrap(response),
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceDiffs", id: workspaceId },
        { type: "WorkspaceActivity", id: workspaceId },
      ],
    }),

    generateCommitMessageGitFlow: builder.mutation<
      string,
      { workspaceId: string; providerId: string; model?: string; includeUnstaged?: boolean }
    >({
      query: (payload) => ({
        handler: CHANNELS.gitFlow.generateCommitMessage,
        args: [payload],
      }),
      transformResponse: (response: ServiceResponse<string>) =>
        unwrap(response),
    }),

    generatePrBodyGitFlow: builder.mutation<
      { title: string; body: string },
      { workspaceId: string; providerId: string; model?: string }
    >({
      query: (payload) => ({
        handler: CHANNELS.gitFlow.generatePrBody,
        args: [payload],
      }),
      transformResponse: (
        response: ServiceResponse<{ title: string; body: string }>,
      ) => unwrap(response),
    }),
  }),
});

export const {
  useGetGitFlowStatusQuery,
  useCommitGitFlowMutation,
  usePushGitFlowMutation,
  useCreatePrGitFlowMutation,
  useGenerateCommitMessageGitFlowMutation,
  useGeneratePrBodyGitFlowMutation,
} = gitFlowApi;
