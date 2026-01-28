import { baseApi } from "./baseApi";

export interface JournalMetadata {
  status: "draft" | "published";
  wordCount?: number;
  lastIndexedAt?: number;
}

export interface JournalEntry {
  id: string;
  accountId: string;
  title: string | null;
  body: string | null;
  summary: string | null;
  metadata: JournalMetadata;
  occurredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalRevision {
  id: number;
  entityId: string;
  title: string | null;
  body: string | null;
  wordCount: number | null;
  createdAt: string;
}

export interface CreateJournalDraftPayload {
  accountId: string;
  title?: string;
  body?: string;
  occurredAt?: Date;
}

export interface UpdateJournalDraftPayload {
  title?: string;
  body?: string;
  summary?: string;
  metadata?: Partial<JournalMetadata>;
}

export interface JournalQueryParams {
  limit?: number;
}

export const journalApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getJournalEntries: builder.query<JournalEntry[], JournalQueryParams>({
      query: (params) => ({
        handler: "journal:getAll",
        args: [params],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Journal" as const, id })),
              { type: "Journal", id: "LIST" },
            ]
          : [{ type: "Journal", id: "LIST" }],
    }),

    getJournalById: builder.query<JournalEntry | null, string>({
      query: (id) => ({
        handler: "journal:getById",
        args: [id],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      providesTags: (_result, _error, id) => [{ type: "Journal", id }],
    }),

    createJournalDraft: builder.mutation<
      JournalEntry,
      CreateJournalDraftPayload
    >({
      query: (payload) => ({
        handler: "journal:createDraft",
        args: [payload],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: [{ type: "Journal", id: "LIST" }],
    }),

    updateJournalDraft: builder.mutation<
      JournalEntry,
      { id: string; payload: UpdateJournalDraftPayload }
    >({
      query: ({ id, payload }) => ({
        handler: "journal:updateDraft",
        args: [id, payload],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      // Don't invalidate on autosave to prevent re-fetches during typing
      // Only invalidate the specific entry
      invalidatesTags: (_result, _error, { id }) => [{ type: "Journal", id }],
    }),

    saveJournal: builder.mutation<JournalEntry, string>({
      query: (id) => ({
        handler: "journal:save",
        args: [id],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: (_result, _error, id) => [
        { type: "Journal", id },
        { type: "Feed", id: "LIST" },
      ],
    }),

    publishJournal: builder.mutation<JournalEntry, string>({
      query: (id) => ({
        handler: "journal:publish",
        args: [id],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: (_result, _error, id) => [
        { type: "Journal", id },
        { type: "Journal", id: "LIST" },
        { type: "Feed", id: "LIST" },
      ],
    }),

    deleteJournal: builder.mutation<boolean, string>({
      query: (id) => ({
        handler: "journal:delete",
        args: [id],
      }),
      transformResponse: (response: any) => response.success,
      invalidatesTags: (_result, _error, id) => [
        { type: "Journal", id },
        { type: "Journal", id: "LIST" },
      ],
    }),

    getJournalRevisions: builder.query<
      JournalRevision[],
      { entityId: string; limit?: number }
    >({
      query: ({ entityId, limit }) => ({
        handler: "journal:getRevisions",
        args: [entityId, { limit }],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
    }),

    markJournalForIndexing: builder.mutation<boolean, string>({
      query: (entityId) => ({
        handler: "journal:markForIndexing",
        args: [entityId],
      }),
      transformResponse: (response: any) => response.success,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetJournalEntriesQuery,
  useLazyGetJournalEntriesQuery,
  useGetJournalByIdQuery,
  useLazyGetJournalByIdQuery,
  useCreateJournalDraftMutation,
  useUpdateJournalDraftMutation,
  useSaveJournalMutation,
  usePublishJournalMutation,
  useDeleteJournalMutation,
  useGetJournalRevisionsQuery,
  useLazyGetJournalRevisionsQuery,
  useMarkJournalForIndexingMutation,
} = journalApi;
