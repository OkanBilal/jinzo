import { baseApi } from './baseApi';

export interface FeedEvent {
  id: number;
  connectionId: string | null;
  eventType: string;
  itemType: string | null;
  occurredAt: string;
  payload: Record<string, any> | null;
  createdAt: string;
}

export interface FeedEventQueryParams {
  connectionIds?: string[];
  eventTypes?: string[];
  itemTypes?: string[];
  limit?: number;
  offset?: number;
}

export const feedApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFeedEvents: builder.query<FeedEvent[], FeedEventQueryParams>({
      query: (params) => ({
        handler: 'feed:getEvents',
        args: [params],
      }),
      transformResponse: (response: any) => response.success ? response.data : [],
      providesTags: (_result, _error, { connectionIds, eventTypes }) => [
        { type: 'Feed', id: `${connectionIds?.join(',') || 'all'}-${eventTypes?.join(',') || 'all'}` },
      ],
    }),

    getRecentFeedEvents: builder.query<FeedEvent[], { limit?: number }>({
      query: ({ limit = 50 }) => ({
        handler: 'feed:getEvents',
        args: [{ limit }],
      }),
      transformResponse: (response: any) => response.success ? response.data : [],
      providesTags: ['Feed'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFeedEventsQuery,
  useGetRecentFeedEventsQuery,
} = feedApi;
