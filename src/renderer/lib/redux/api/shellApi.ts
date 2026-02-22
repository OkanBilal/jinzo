import { baseApi } from './baseApi';

export interface InstalledApp {
  id: string;
  name: string;
  bundleId: string;
  path: string;
  icon: string | null;
}

export const shellApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInstalledApps: builder.query<InstalledApp[], void>({
      query: () => ({
        handler: 'shell:getInstalledApps',
      }),
      transformResponse: (response: any) => response.success ? response.data : [],
      providesTags: ['InstalledApps'],
      keepUnusedDataFor: 3600,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetInstalledAppsQuery,
} = shellApi;
