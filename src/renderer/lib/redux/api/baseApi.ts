import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import type { ServiceResponse } from '../../../../shared/ipc-kit/service-response';

const ipcBaseQuery = (): BaseQueryFn<
  {
    handler: string;
    args?: any[];
  },
  ServiceResponse<unknown>,
  unknown
> => async ({ handler, args = [] }) => {
  try {
    const [namespace, method] = handler.split(':');
    const apiNamespace = (window.api as any)[namespace];

    if (!apiNamespace || typeof apiNamespace[method] !== 'function') {
      throw new Error(`Handler ${handler} not found`);
    }

    const result: ServiceResponse<unknown> = await apiNamespace[method](...args);

    if (!result.success) {
      return { error: result.error };
    }

    return { data: result };
  } catch (error: any) {
    return {
      error: {
        status: 'CUSTOM_ERROR',
        error: error.message || 'An error occurred',
      },
    };
  }
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: ipcBaseQuery(),
  // Drop unused cache entries after 60s by default to keep RAM bounded.
  // Individual endpoints can override this if they need longer retention.
  keepUnusedDataFor: 60,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: [
    'ConnectionState',
    'Connection',
    'Entity',
    'Task',
    'Issue',
    'Account',
    'Spaces',
    'AppSettings',
    'Providers',
    'ProviderModels',
    'ProviderCommands',
    'ProviderSkills',
    'ProviderPlugins',
    'ProviderAccountInfo',
    'ToolCalls',
    'Workspaces',
    'Runs',
    'RunContext',
    'RunArtifacts',
    'RunTurns',
    'ProjectResources',
    'ProjectIssues',
    'WorkspaceDiffs',
    'Reviews',
    'ReviewFindings',
    'Projects',
    'Updates',
    'InstalledApps',
    'AppsForFile',
    'Stats',
    'WorkspaceActivity',
    'Automations',
    'Pulse',
    'ProjectSignals',
  ],
  endpoints: () => ({}),
});
