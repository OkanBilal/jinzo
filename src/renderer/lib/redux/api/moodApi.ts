import { baseApi } from "./baseApi";

export interface Mood {
  id: string;
  accountId: string;
  name: string;
  slug: string;
  description: string | null;
  systemPrompt: string | null;
  model: string | null;
  icon: string | null;
  themeConfig: string | null;
  uiConfig: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateMoodPayload {
  name: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  icon?: string;
  themeConfig?: string;
  uiConfig?: string;
  sortOrder?: number;
}

export interface UpdateMoodPayload {
  name?: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  icon?: string;
  themeConfig?: string;
  uiConfig?: string;
  sortOrder?: number;
}

export const moodApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMoods: builder.query<Mood[], void>({
      query: () => ({
        handler: "mood:getAll",
      }),
      transformResponse: (response: { success: boolean; data: Mood[] }) =>
        response.data,
      providesTags: ["Moods"],
    }),

    getMoodById: builder.query<Mood, string>({
      query: (moodId) => ({
        handler: "mood:getById",
        args: [moodId],
      }),
      transformResponse: (response: { success: boolean; data: Mood }) =>
        response.data,
      providesTags: (_result, _error, id) => [{ type: "Moods", id }],
    }),

    createMood: builder.mutation<Mood, CreateMoodPayload>({
      query: (payload) => ({
        handler: "mood:create",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: Mood }) =>
        response.data,
      invalidatesTags: ["Moods"],
    }),

    updateMood: builder.mutation<
      Mood,
      { id: string; payload: UpdateMoodPayload }
    >({
      query: ({ id, payload }) => ({
        handler: "mood:update",
        args: [id, payload],
      }),
      transformResponse: (response: { success: boolean; data: Mood }) =>
        response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Moods", id },
        "Moods",
      ],
    }),

    deleteMood: builder.mutation<void, string>({
      query: (moodId) => ({
        handler: "mood:delete",
        args: [moodId],
      }),
      invalidatesTags: ["Moods", "AppSettings"],
    }),

    archiveMood: builder.mutation<void, string>({
      query: (moodId) => ({
        handler: "mood:archive",
        args: [moodId],
      }),
      invalidatesTags: ["Moods"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMoodsQuery,
  useGetMoodByIdQuery,
  useLazyGetMoodByIdQuery,
  useCreateMoodMutation,
  useUpdateMoodMutation,
  useDeleteMoodMutation,
  useArchiveMoodMutation,
} = moodApi;
