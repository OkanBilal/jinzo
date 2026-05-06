import { baseApi } from './baseApi';

export interface InstalledApp {
  id: string;
  name: string;
  bundleId: string;
  path: string;
  icon: string | null;
}

/** Launch Services–reported app that can open a given file (macOS). */
export interface FileHandlerApp {
  bundleId: string;
  name: string;
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
    getAppsForFile: builder.query<FileHandlerApp[], string>({
      query: (filePath) => ({
        handler: 'shell:getAppsForFile',
        args: [filePath],
      }),
      transformResponse: (response: any) =>
        response?.success && Array.isArray(response.data) ? response.data : [],
      providesTags: (_result, _err, filePath) => [{ type: 'AppsForFile' as const, id: filePath }],
      keepUnusedDataFor: 300,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetInstalledAppsQuery,
  useLazyGetAppsForFileQuery,
} = shellApi;
