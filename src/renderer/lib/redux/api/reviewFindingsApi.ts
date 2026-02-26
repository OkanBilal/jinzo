import { baseApi } from "./baseApi";

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
  metadata?: Record<string, unknown> | null;
}

export const reviewFindingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getReviewFindingsByReview: builder.query<
      ReviewFinding[],
      { reviewId: string; limit?: number }
    >({
      query: ({ reviewId, limit }) => ({
        handler: "reviewFindings:getByReview",
        args: [reviewId, limit],
      }),
      transformResponse: (response: any) => response?.data ?? [],
      providesTags: ["ReviewFindings"],
    }),

    getReviewFindingById: builder.query<ReviewFinding, string>({
      query: (id) => ({
        handler: "reviewFindings:getById",
        args: [id],
      }),
      transformResponse: (response: any) => response?.data ?? null,
      providesTags: (_result, _err, id) => [{ type: "ReviewFindings", id }],
    }),

    createReviewFinding: builder.mutation<string, CreateReviewFindingPayload>({
      query: (payload) => ({
        handler: "reviewFindings:create",
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
        handler: "reviewFindings:createMany",
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
        handler: "reviewFindings:update",
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
        handler: "reviewFindings:delete",
        args: [id],
      }),
      invalidatesTags: ["ReviewFindings"],
    }),
  }),
});

export const {
  useGetReviewFindingsByReviewQuery,
  useGetReviewFindingByIdQuery,
  useCreateReviewFindingMutation,
  useCreateReviewFindingsMutation,
  useUpdateReviewFindingMutation,
  useDeleteReviewFindingMutation,
} = reviewFindingsApi;
