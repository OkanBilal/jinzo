import { baseApi } from "./baseApi";

export interface Space {
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

export interface CreateSpacePayload {
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

export interface UpdateSpacePayload {
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

export const spaceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSpaces: builder.query<Space[], void>({
      query: () => ({
        handler: "space:getAll",
      }),
      transformResponse: (response: { success: boolean; data: Space[] }) =>
        response.data,
      providesTags: ["Spaces"],
    }),

    getSpaceById: builder.query<Space, string>({
      query: (spaceId) => ({
        handler: "space:getById",
        args: [spaceId],
      }),
      transformResponse: (response: { success: boolean; data: Space }) =>
        response.data,
      providesTags: (_result, _error, id) => [{ type: "Spaces", id }],
    }),

    createSpace: builder.mutation<Space, CreateSpacePayload>({
      query: (payload) => ({
        handler: "space:create",
        args: [payload],
      }),
      transformResponse: (response: { success: boolean; data: Space }) =>
        response.data,
      invalidatesTags: ["Spaces"],
    }),

    updateSpace: builder.mutation<
      Space,
      { id: string; payload: UpdateSpacePayload }
    >({
      query: ({ id, payload }) => ({
        handler: "space:update",
        args: [id, payload],
      }),
      transformResponse: (response: { success: boolean; data: Space }) =>
        response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Spaces", id },
        "Spaces",
      ],
    }),

    deleteSpace: builder.mutation<void, string>({
      query: (spaceId) => ({
        handler: "space:delete",
        args: [spaceId],
      }),
      invalidatesTags: ["Spaces", "AppSettings"],
    }),

    archiveSpace: builder.mutation<void, string>({
      query: (spaceId) => ({
        handler: "space:archive",
        args: [spaceId],
      }),
      invalidatesTags: ["Spaces"],
    }),

    unarchiveSpace: builder.mutation<void, string>({
      query: (spaceId) => ({
        handler: "space:unarchive",
        args: [spaceId],
      }),
      invalidatesTags: ["Spaces"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSpacesQuery,
  useGetSpaceByIdQuery,
  useLazyGetSpaceByIdQuery,
  useCreateSpaceMutation,
  useUpdateSpaceMutation,
  useDeleteSpaceMutation,
  useArchiveSpaceMutation,
  useUnarchiveSpaceMutation,
} = spaceApi;
