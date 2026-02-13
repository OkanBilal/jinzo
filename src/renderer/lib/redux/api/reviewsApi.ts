import { baseApi } from "./baseApi";

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

export const reviewsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getReviewsByWorkspace: builder.query<
      Review[],
      { workspaceId: string; limit?: number }
    >({
      query: ({ workspaceId, limit }) => ({
        handler: "reviews:getByWorkspace",
        args: [workspaceId, limit],
      }),
      transformResponse: (response: any) => response?.data ?? [],
      providesTags: ["Reviews"],
    }),

    getReviewById: builder.query<Review, string>({
      query: (id) => ({
        handler: "reviews:getById",
        args: [id],
      }),
      transformResponse: (response: any) => response?.data ?? null,
      providesTags: (_result, _err, id) => [{ type: "Reviews", id }],
    }),

    createReview: builder.mutation<string, CreateReviewPayload>({
      query: (payload) => ({
        handler: "reviews:create",
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
        handler: "reviews:update",
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
        handler: "reviews:delete",
        args: [id],
      }),
      invalidatesTags: ["Reviews"],
    }),
  }),
});

export const {
  useGetReviewsByWorkspaceQuery,
  useGetReviewByIdQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
} = reviewsApi;
