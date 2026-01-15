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
  sources?: string[];
  itemTypes?: string[];
  limit?: number;
  page?: number;
}

export const feedApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFeedItems: builder.query<FeedItem[], FeedQueryParams>({
      query: ({ sources, itemTypes, limit = 10 }) => ({
        handler: 'feed:getItems',
        args: [{
          sources,
          itemTypes,
          limit,
        }],
      }),
      transformResponse: (response: any) => response.success ? response.data : [],
      providesTags: (_result, _error, { sources, itemTypes }) => [
        { type: 'Feed', id: `${sources?.join(',') || 'all'}-${itemTypes?.join(',') || 'all'}` },
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
