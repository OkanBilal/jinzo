import { baseApi } from './baseApi';

export interface Connection {
  id: string;
  provider: string;
  status: string;
  metadata?: any;
}

export interface GitHubRepo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string;
}

export interface SelectedRepo {
  id: string;
  fullName: string;
  name: string;
  metadata: any;
}

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  issueCount: number;
}

export interface SelectedTeam {
  id: string;
  key: string;
  name: string;
  metadata: any;
}

export interface SelectedCollection {
  id: string;
  externalId: string;
  name: string;
  metadata: any;
}

export interface SelectedPodcast {
  id: string;
  name: string;
  metadata: any;
}

export interface HackerNewsSettings {
  topStories: boolean;
  userSubmissions: boolean;
  userComments: boolean;
}

export interface HackerNewsStatus {
  enabled: boolean;
  username: string | null;
  settings: HackerNewsSettings;
}

export interface UpdateHackerNewsPayload {
  enabled: boolean;
  username: string | null;
  topStories: boolean;
  userSubmissions: boolean;
  userComments: boolean;
}

export interface RssFeed {
  id: string;
  name: string;
  metadata: any;
}

export interface RssStatus {
  enabled: boolean;
  connectionId: string | null;
  feeds: RssFeed[];
}

export interface UpdateRssPayload {
  enabled: boolean;
}

export interface RaindropCollection {
  id: number;
  title: string;
  count: number;
  public: boolean;
  cover: string | null;
  color: string | null;
  created: string;
  lastUpdate: string;
}

export interface SaveCredentialsPayload {
  provider: string;
  connectionId: string;
  token?: string;
  apiKey?: string;
  userId?: string;
  developerToken?: string;
  userToken?: string;
  accessToken?: string;
}

export interface SaveResourcesPayload {
  provider: string;
  connectionId: string;
  resources: any[];
}

export const connectionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    
    getConnection: builder.query<{ success: boolean; connection: Connection }, string>({
      query: (provider) => ({
        handler: 'connections:getByProvider',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, connection: response.data.connection } : { success: false, connection: null as any },
      providesTags: ['Apps'],
    }),

    saveCredentials: builder.mutation<{ success: boolean }, SaveCredentialsPayload>({
      query: (body) => ({
        handler: 'connectionCredentials:save',
        args: [body],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['Apps'],
    }),

    getGitHubRepos: builder.query<{ success: boolean; repos: GitHubRepo[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getGithubRepos',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, repos: response.data.repos } : { success: false, repos: [] },
    }),

    getRaindropCollections: builder.query<{ success: boolean; collections: RaindropCollection[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getRaindropCollections',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, collections: response.data.collections } : { success: false, collections: [] },
    }),

    getLinearTeams: builder.query<{ success: boolean; teams: LinearTeam[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getLinearTeams',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, teams: response.data.teams } : { success: false, teams: [] },
    }),

    getSelectedTeams: builder.query<{ success: boolean; teams: SelectedTeam[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, teams: response.data.teams, connectionId: response.data.connectionId } : { success: false, teams: [], connectionId: '' },
      providesTags: ['Apps'],
    }),

    getSelectedRepos: builder.query<{ success: boolean; repos: SelectedRepo[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, repos: response.data.repos, connectionId: response.data.connectionId } : { success: false, repos: [], connectionId: '' },
      providesTags: ['Apps'],
    }),

    getSelectedCollections: builder.query<{ success: boolean; collections: SelectedCollection[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, collections: response.data.collections, connectionId: response.data.connectionId } : { success: false, collections: [], connectionId: '' },
      providesTags: ['Apps'],
    }),

    getSelectedPodcasts: builder.query<{ success: boolean; podcasts: SelectedPodcast[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, podcasts: response.data.podcasts, connectionId: response.data.connectionId } : { success: false, podcasts: [], connectionId: '' },
      providesTags: ['Apps'],
    }),

    getHackerNewsStatus: builder.query<{ success: boolean; enabled: boolean; username: string | null; settings: HackerNewsSettings }, void>({
      query: () => ({
        handler: 'connections:getHackerNewsStatus',
        args: [],
      }),
      transformResponse: (response: any) => response.success ? { success: true, ...response.data } : { success: false, enabled: false, username: null, settings: { topStories: false, userSubmissions: false, userComments: false } },
      providesTags: ['Apps'],
    }),

    updateHackerNewsSettings: builder.mutation<{ success: boolean }, UpdateHackerNewsPayload>({
      query: (body) => ({
        handler: 'connections:toggleHackerNews',
        args: [body],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['Apps'],
    }),

    getRssStatus: builder.query<{ success: boolean; enabled: boolean; connectionId: string | null; feeds: RssFeed[] }, void>({
      query: () => ({
        handler: 'connections:getRssStatus',
        args: [],
      }),
      transformResponse: (response: any) => response.success ? { success: true, ...response.data } : { success: false, enabled: false, connectionId: null, feeds: [] },
      providesTags: ['Apps'],
    }),

    updateRssSettings: builder.mutation<{ success: boolean; connectionId?: string }, UpdateRssPayload>({
      query: (body) => ({
        handler: 'connections:toggleRss',
        args: [body],
      }),
      transformResponse: (response: any) => response.success ? { success: true, connectionId: response.data?.connectionId } : { success: false },
      invalidatesTags: ['Apps'],
    }),

    saveResources: builder.mutation<{ success: boolean }, SaveResourcesPayload>({
      query: (body) => ({
        handler: 'connections:saveResources',
        args: [body],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['Apps'],
    }),

    deleteResource: builder.mutation<{ success: boolean }, string>({
      query: (resourceId) => ({
        handler: 'connections:deleteResource',
        args: [resourceId],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['Apps'],
    }),

    revokeConnection: builder.mutation<{ success: boolean }, string>({
      query: (provider) => ({
        handler: 'connections:revoke',
        args: [provider],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['Apps'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetConnectionQuery,
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetGitHubReposQuery,
  useLazyGetRaindropCollectionsQuery,
  useLazyGetLinearTeamsQuery,
  useGetSelectedReposQuery,
  useLazyGetSelectedReposQuery,
  useGetSelectedTeamsQuery,
  useLazyGetSelectedTeamsQuery,
  useGetSelectedCollectionsQuery,
  useLazyGetSelectedCollectionsQuery,
  useGetSelectedPodcastsQuery,
  useLazyGetSelectedPodcastsQuery,
  useGetHackerNewsStatusQuery,
  useLazyGetHackerNewsStatusQuery,
  useUpdateHackerNewsSettingsMutation,
  useGetRssStatusQuery,
  useLazyGetRssStatusQuery,
  useUpdateRssSettingsMutation,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
} = connectionsApi;
