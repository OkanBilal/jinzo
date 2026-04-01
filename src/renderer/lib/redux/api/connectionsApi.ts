import { baseApi } from './baseApi';
import { syncApi } from './syncApi';
import { toast } from '@/components/ui';

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

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrl: string | null;
}

export interface AsanaProject {
  gid: string;
  name: string;
  archived: boolean;
  color: string | null;
  workspaceGid: string;
  workspaceName: string;
  teamGid?: string | null;
  teamName?: string | null;
}

export interface SelectedAsanaProject {
  id: string;
  gid: string;
  name: string;
  metadata: any;
}

export interface SelectedProject {
  id: string;
  key: string;
  name: string;
  metadata: any;
}

export interface GitLabProject {
  id: number;
  name: string;
  pathWithNamespace: string;
  webUrl: string;
  description: string | null;
  visibility: string;
  lastActivityAt: string | null;
}

export interface SelectedGitLabProject {
  id: string;
  externalId: string;
  name: string;
  metadata: any;
}

export interface TrelloBoard {
  id: string;
  name: string;
  shortLink: string;
  shortUrl: string;
  desc: string;
  closed: boolean;
  organizationName?: string | null;
}

export interface SelectedTrelloBoard {
  id: string;
  boardId: string;
  name: string;
  metadata: any;
}

export interface SentryProject {
  id: string;
  slug: string;
  name: string;
  platform: string | null;
  dateCreated: string;
  status: string;
  organization: string;
}

export interface SelectedSentryProject {
  id: string;
  slug: string;
  name: string;
  metadata: any;
}

export interface SocketDevOrganization {
  id: string;
  slug: string;
  name: string;
  plan: string | null;
}

export interface SelectedSocketDevOrganization {
  id: string;
  slug: string;
  name: string;
  metadata: any;
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
  apiToken?: string; // jira
  domain?: string; // jira
  email?: string; // jira
  organization?: string; // sentry
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
      providesTags: ['ConnectionStates'],
    }),

    saveCredentials: builder.mutation<{ success: boolean }, SaveCredentialsPayload>({
      query: (body) => ({
        handler: 'connectionCredentials:save',
        args: [body],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['ConnectionStates'],
    }),

    getGitHubRepos: builder.query<{ success: boolean; repos: GitHubRepo[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getGithubRepos',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, repos: response.data.repos } : { success: false, repos: [] },
    }),

    getLinearTeams: builder.query<{ success: boolean; teams: LinearTeam[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getLinearTeams',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, teams: response.data.teams } : { success: false, teams: [] },
    }),

    getJiraProjects: builder.query<{ success: boolean; projects: JiraProject[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getJiraProjects',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, projects: response.data.projects } : { success: false, projects: [] },
    }),

    getAsanaProjects: builder.query<{ success: boolean; projects: AsanaProject[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getAsanaProjects',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, projects: response.data.projects } : { success: false, projects: [] },
    }),

    getGitLabProjects: builder.query<{ success: boolean; projects: GitLabProject[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getGitlabProjects',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, projects: response.data.projects } : { success: false, projects: [] },
    }),

    getTrelloBoards: builder.query<{ success: boolean; boards: TrelloBoard[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getTrelloBoards',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, boards: response.data.boards } : { success: false, boards: [] },
    }),

    getSentryProjects: builder.query<{ success: boolean; projects: SentryProject[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getSentryProjects',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, projects: response.data.projects } : { success: false, projects: [] },
    }),

    getSelectedSentryProjects: builder.query<{ success: boolean; projects: SelectedSentryProject[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, projects: response.data.projects, connectionId: response.data.connectionId } : { success: false, projects: [], connectionId: '' },
      providesTags: ['ConnectionStates'],
    }),

    getSocketDevOrganizations: builder.query<{ success: boolean; organizations: SocketDevOrganization[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getSocketDevOrganizations',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, organizations: response.data.organizations } : { success: false, organizations: [] },
    }),

    getSelectedSocketDevOrganizations: builder.query<{ success: boolean; organizations: SelectedSocketDevOrganization[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, organizations: response.data.organizations, connectionId: response.data.connectionId } : { success: false, organizations: [], connectionId: '' },
      providesTags: ['ConnectionStates'],
    }),

    getSelectedTrelloBoards: builder.query<{ success: boolean; boards: SelectedTrelloBoard[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, boards: response.data.boards, connectionId: response.data.connectionId } : { success: false, boards: [], connectionId: '' },
      providesTags: ['ConnectionStates'],
    }),

    getSelectedGitLabProjects: builder.query<{ success: boolean; projects: SelectedGitLabProject[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, projects: response.data.projects, connectionId: response.data.connectionId } : { success: false, projects: [], connectionId: '' },
      providesTags: ['ConnectionStates'],
    }),

    getSelectedAsanaProjects: builder.query<{ success: boolean; projects: SelectedAsanaProject[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, projects: response.data.projects, connectionId: response.data.connectionId } : { success: false, projects: [], connectionId: '' },
      providesTags: ['ConnectionStates'],
    }),

    getSelectedProjects: builder.query<{ success: boolean; projects: SelectedProject[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, projects: response.data.projects, connectionId: response.data.connectionId } : { success: false, projects: [], connectionId: '' },
      providesTags: ['ConnectionStates'],
    }),

    getSelectedTeams: builder.query<{ success: boolean; teams: SelectedTeam[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, teams: response.data.teams, connectionId: response.data.connectionId } : { success: false, teams: [], connectionId: '' },
      providesTags: ['ConnectionStates'],
    }),

    getSelectedRepos: builder.query<{ success: boolean; repos: SelectedRepo[]; connectionId: string }, string>({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, repos: response.data.repos, connectionId: response.data.connectionId } : { success: false, repos: [], connectionId: '' },
      providesTags: ['ConnectionStates'],
    }),

    saveResources: builder.mutation<{ success: boolean }, SaveResourcesPayload>({
      query: (body) => ({
        handler: 'connections:saveResources',
        args: [body],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['ConnectionStates'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          const syncPromise = dispatch(syncApi.endpoints.runEntitySync.initiate(arg.provider)).unwrap();
          toast.promise(syncPromise, {
            loading: "Syncing...",
            success: (data) => `Synced ${data.total} items`,
            error: "Sync failed",
          });
        } catch {
          // save itself failed — no sync needed
        }
      },
    }),

    deleteResource: builder.mutation<{ success: boolean }, string>({
      query: (resourceId) => ({
        handler: 'connections:deleteResource',
        args: [resourceId],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['ConnectionStates'],
    }),

    revokeConnection: builder.mutation<{ success: boolean }, string>({
      query: (provider) => ({
        handler: 'connections:revoke',
        args: [provider],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['ConnectionStates'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetConnectionQuery,
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetGitHubReposQuery,
  useLazyGetLinearTeamsQuery,
  useLazyGetJiraProjectsQuery,
  useLazyGetAsanaProjectsQuery,
  useLazyGetGitLabProjectsQuery,
  useLazyGetTrelloBoardsQuery,
  useGetSelectedReposQuery,
  useLazyGetSelectedReposQuery,
  useGetSelectedTeamsQuery,
  useLazyGetSelectedTeamsQuery,
  useGetSelectedProjectsQuery,
  useLazyGetSelectedProjectsQuery,
  useGetSelectedAsanaProjectsQuery,
  useLazyGetSelectedAsanaProjectsQuery,
  useGetSelectedGitLabProjectsQuery,
  useLazyGetSelectedGitLabProjectsQuery,
  useGetSelectedTrelloBoardsQuery,
  useLazyGetSelectedTrelloBoardsQuery,
  useLazyGetSentryProjectsQuery,
  useGetSelectedSentryProjectsQuery,
  useLazyGetSelectedSentryProjectsQuery,
  useLazyGetSocketDevOrganizationsQuery,
  useGetSelectedSocketDevOrganizationsQuery,
  useLazyGetSelectedSocketDevOrganizationsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
} = connectionsApi;
