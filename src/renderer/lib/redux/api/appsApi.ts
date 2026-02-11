import { baseApi } from './baseApi';

export interface AppState {
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

export interface UpdateAppConnectionPayload {
  isConnected: boolean;
  connectionId?: string | null;
}

export const appsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    getApps: builder.query<AppState[], void>({
      query: () => ({
        handler: 'apps:getAll',
      }),
      transformResponse: (response: any) => response.success ? response.data : [],
      providesTags: ['Apps'],
    }),

    updateAppConnection: builder.mutation<
      { success: boolean },
      { id: string } & UpdateAppConnectionPayload
    >({
      query: ({ id, ...body }) => ({
        handler: 'apps:updateById',
        args: [id, body],
      }),
      invalidatesTags: ['Apps'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAppsQuery,
  useUpdateAppConnectionMutation,
} = appsApi;
