import { baseApi } from './baseApi';
import { syncApi } from './syncApi';
import { toast } from '@/components/ui';

// ─────────────────────────────────────────────────────────────
// Connection identity + integration state
// ─────────────────────────────────────────────────────────────

/** A row in the connections table — one external account. */
export interface Connection {
  id: string;
  provider: string;
  status: string;
  metadata?: any;
}

/** A row in the connection_states table — one supported integration shown on the Settings page. */
export interface ConnectionState {
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

export interface UpdateConnectionStatePayload {
  isConnected: boolean;
  connectionId?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Resource types per provider
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Payload types
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────────────────────
// Split RTK Query tag types so the Settings integration list
// (`ConnectionState`) refreshes independently from per-connection
// queries (`Connection`). See ADR-0002.
// ─────────────────────────────────────────────────────────────
export const connectionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ── integration-state list (Settings page) ──
    getConnectionStates: builder.query<ConnectionState[], void>({
      query: () => ({
        handler: 'connections:listStates',
      }),
      transformResponse: (response: any) => response.success ? response.data : [],
      providesTags: ['ConnectionState'],
    }),

    updateConnectionState: builder.mutation<
      { success: boolean },
      { id: string } & UpdateConnectionStatePayload
    >({
      query: ({ id, ...body }) => ({
        handler: 'connections:updateState',
        args: [id, body],
      }),
      invalidatesTags: ['ConnectionState'],
    }),

    // ── identity ──
    getConnection: builder.query<{ success: boolean; connection: Connection }, string>({
      query: (provider) => ({
        handler: 'connections:getByProvider',
        args: [provider],
      }),
      transformResponse: (response: any) => response.success ? { success: true, connection: response.data.connection } : { success: false, connection: null as any },
      providesTags: ['Connection'],
    }),

    saveCredentials: builder.mutation<{ success: boolean }, SaveCredentialsPayload>({
      query: (body) => ({
        handler: 'connections:saveCredentials',
        args: [body],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      // Saving credentials flips `isConnected` in connection_states AND mints
      // a new connection row, so both tag families must refresh.
      invalidatesTags: ['Connection', 'ConnectionState'],
    }),

    revokeConnection: builder.mutation<{ success: boolean }, string>({
      query: (provider) => ({
        handler: 'connections:revoke',
        args: [provider],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['Connection', 'ConnectionState'],
    }),

    // ── per-provider resource discovery ──
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

    getSocketDevOrganizations: builder.query<{ success: boolean; organizations: SocketDevOrganization[] }, string>({
      query: (connectionId) => ({
        handler: 'connections:getSocketDevOrganizations',
        args: [connectionId],
      }),
      transformResponse: (response: any) => response.success ? { success: true, organizations: response.data.organizations } : { success: false, organizations: [] },
    }),

    /**
     * Generic accessor for the items the user has linked under a connection.
     * Main returns `{ [providerSpecificKey]: items, connectionId }` (e.g. `repos`,
     * `teams`, `projects`, `boards`, `organizations`); we strip the wrapping key
     * here so the renderer always sees `{ items, connectionId }`.
     */
    getSelectedResources: builder.query<
      { success: boolean; items: any[]; connectionId: string },
      string
    >({
      query: (provider) => ({
        handler: 'connections:getSelectedResources',
        args: [provider],
      }),
      transformResponse: (response: any) => {
        if (!response.success) return { success: false, items: [], connectionId: '' };
        const { connectionId = '', ...rest } = response.data ?? {};
        const items = (Object.values(rest)[0] as any[]) ?? [];
        return { success: true, items, connectionId };
      },
      providesTags: ['Connection'],
    }),

    saveResources: builder.mutation<{ success: boolean }, SaveResourcesPayload>({
      query: (body) => ({
        handler: 'connections:saveResources',
        args: [body],
      }),
      transformResponse: (response: any) => ({ success: response.success }),
      invalidatesTags: ['Connection'],
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
      invalidatesTags: ['Connection'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetConnectionStatesQuery,
  useUpdateConnectionStateMutation,
  useGetConnectionQuery,
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useRevokeConnectionMutation,
  useLazyGetGitHubReposQuery,
  useLazyGetLinearTeamsQuery,
  useLazyGetJiraProjectsQuery,
  useLazyGetAsanaProjectsQuery,
  useLazyGetGitLabProjectsQuery,
  useLazyGetTrelloBoardsQuery,
  useLazyGetSentryProjectsQuery,
  useLazyGetSocketDevOrganizationsQuery,
  useGetSelectedResourcesQuery,
  useLazyGetSelectedResourcesQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
} = connectionsApi;
