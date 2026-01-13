import type { FeedItem } from '../../cron';

import { baseApi } from './baseApi';

export type FeedSource = 
  | 'github' 
  | 'podcast' 
  | 'appleMusic' 
  | 'raindrop' 
  | 'hackerNews'
  | 'newyorker'
  | 'aworkinglibrary';

export interface FeedQueryParams {
  source: FeedSource;
  limit?: number;
  page?: number;
}

export const feedApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFeedItems: builder.query<FeedItem[], FeedQueryParams>({
      query: ({ source, limit = 10, page = 1 }) => ({
        handler: 'feed:getItems',
        args: [{
          sources: source ? [source] : undefined,
          limit,
        }],
      }),
      transformResponse: (response: any) => response.success ? response.data : [],
      providesTags: (_result, _error, { source }) => [
        { type: 'Feed', id: source },
      ],
    }),

    getCombinedFeed: builder.query<FeedItem[], { limit?: number }>({
      query: ({ limit = 50 }) => ({
        handler: 'feed:getItems',
        args: [{ limit }],
      }),
      transformResponse: (response: any) => response.success ? response.data : [],
      providesTags: ['Feed'],
    }),

    runFeedSync: builder.mutation<{ success: boolean; data: any }, void>({
      query: () => ({
        handler: 'cron:runFeedSync',
        args: [],
      }),
      invalidatesTags: ['Feed'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFeedItemsQuery,
  useGetCombinedFeedQuery,
  useRunFeedSyncMutation,
} = feedApi;
