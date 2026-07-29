import { baseApi } from "./baseApi";
import { CHANNELS } from "../../../../shared/ipc-kit/channels";

export type CueKind = "note" | "prompt" | "todo";
export type CueStatus = "inbox" | "active" | "done";

export interface Cue {
  id: string;
  accountId: string;
  projectId: string;
  sourceWorkspaceId: string | null;
  kind: CueKind;
  status: CueStatus;
  title: string | null;
  content: string;
  isPinned: boolean;
  sortOrder: number;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCueInput {
  projectId: string;
  sourceWorkspaceId?: string | null;
  kind?: CueKind;
  title?: string | null;
  content: string;
  status?: CueStatus;
  isPinned?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
}

export type UpdateCueInput = Partial<
  Pick<
    Cue,
    | "sourceWorkspaceId"
    | "kind"
    | "title"
    | "content"
    | "status"
    | "isPinned"
    | "sortOrder"
  >
> & { metadata?: Record<string, unknown> | null };

export const cuesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listCuesByProject: builder.query<Cue[], string>({
      query: (projectId) => ({
        handler: CHANNELS.cues.listByProject,
        args: [projectId],
      }),
      providesTags: (_result, _error, projectId) => [{ type: "Cue", id: projectId }],
    }),
    getCueById: builder.query<Cue | null, string>({
      query: (id) => ({ handler: CHANNELS.cues.getById, args: [id] }),
      providesTags: (_result, _error, id) => [{ type: "Cue", id }],
    }),
    createCue: builder.mutation<Cue, { accountId: string; input: CreateCueInput }>({
      query: ({ accountId, input }) => ({
        handler: CHANNELS.cues.create,
        args: [accountId, input],
      }),
      invalidatesTags: (_result, _error, { input }) => [{ type: "Cue", id: input.projectId }],
    }),
    updateCue: builder.mutation<Cue, { id: string; projectId: string; input: UpdateCueInput }>({
      query: ({ id, input }) => ({ handler: CHANNELS.cues.update, args: [id, input] }),
      invalidatesTags: (_result, _error, { id, projectId }) => [
        { type: "Cue", id },
        { type: "Cue", id: projectId },
      ],
    }),
    deleteCue: builder.mutation<void, { id: string; projectId: string }>({
      query: ({ id }) => ({ handler: CHANNELS.cues.delete, args: [id] }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: "Cue", id: projectId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListCuesByProjectQuery,
  useGetCueByIdQuery,
  useCreateCueMutation,
  useUpdateCueMutation,
  useDeleteCueMutation,
} = cuesApi;
