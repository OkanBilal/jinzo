// Git Flow API — deterministic commit / push / PR operations driven from the
// git-actions panel (no chat agent). Mutations invalidate the workspace diff
// and activity caches so the Changes tab / activity feed refresh in place.

import { baseApi } from "./baseApi";
import { CHANNELS } from "../../../../shared/ipc-kit/channels";

export interface GitFlowStatus {
  branch: string;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  hasRemote: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  isDefaultBranch: boolean;
}

export interface PublishPreflight {
  ghReady: boolean;
  login: string | null;
  suggestedName: string;
  branch: string;
  hasRemote: boolean;
  notReadyReason?: string;
}

export interface PublishResult {
  url: string;
  branch: string;
  owner: string;
  repo: string;
}

export interface PublishRepoPayload {
  workspaceId: string;
  ownerRepo: string;
  visibility: "private" | "public";
  remoteName?: string;
  protocol: "ssh" | "https";
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
      invalidatesTags: (_result, _error, workspaceId) => [
        { type: "WorkspaceDiffs", id: workspaceId },
      ],
    }),

    createPrGitFlow: builder.mutation<{ url: string }, CreatePrGitFlowPayload>({
      query: (payload) => ({
        handler: CHANNELS.gitFlow.createPr,
        args: [payload],
      }),
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
    }),

    generatePrBodyGitFlow: builder.mutation<
      { title: string; body: string },
      { workspaceId: string; providerId: string; model?: string }
    >({
      query: (payload) => ({
        handler: CHANNELS.gitFlow.generatePrBody,
        args: [payload],
      }),
    }),

    getPublishPreflight: builder.query<PublishPreflight, string>({
      query: (workspaceId) => ({
        handler: CHANNELS.gitFlow.getPublishPreflight,
        args: [workspaceId],
      }),
      keepUnusedDataFor: 0,
    }),

    publishRepo: builder.mutation<PublishResult, PublishRepoPayload>({
      query: (payload) => ({
        handler: CHANNELS.gitFlow.publish,
        args: [payload],
      }),
      // A published repo now has a remote — refresh the workspace diff (sidebar)
      // and projects cache. The panel refetches its own gitFlow status directly.
      invalidatesTags: (_result, _error, { workspaceId }) => [
        { type: "WorkspaceDiffs", id: workspaceId },
        "Projects",
      ],
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
  useGetPublishPreflightQuery,
  usePublishRepoMutation,
} = gitFlowApi;
