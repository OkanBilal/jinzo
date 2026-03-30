import { baseApi } from './baseApi';

export interface ConnectionStates {
  id: string;
  displayName: string;
  iconPath: string;
  isConnected: boolean;
  connectionId: string | null;
  category: string;
  sortOrder: number;
  enabledFeatures: string | null;
  config: string | null;
}

export interface UpdateConnectionStatesPayload {
  isConnected: boolean;
  connectionId?: string | null;
}

export const connectionStatesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    getConnectionStates: builder.query<ConnectionStates[], void>({
      query: () => ({
        handler: 'connectionStates:getAll',
      }),
      transformResponse: (response: any) => response.success ? response.data : [],
      providesTags: ['ConnectionStates'],
    }),

    updateConnectionStates: builder.mutation<
      { success: boolean },
      { id: string } & UpdateConnectionStatesPayload
    >({
      query: ({ id, ...body }) => ({
        handler: 'connectionStates:updateById',
        args: [id, body],
      }),
      invalidatesTags: ['ConnectionStates'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetConnectionStatesQuery,
  useUpdateConnectionStatesMutation,
} = connectionStatesApi;
