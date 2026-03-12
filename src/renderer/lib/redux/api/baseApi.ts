import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';

const ipcBaseQuery = (): BaseQueryFn<
  {
    handler: string;
    args?: any[];
  },
  unknown,
  unknown
> => async ({ handler, args = [] }) => {
  try {
    // Split handler into namespace and method (e.g., 'account:get' => ['account', 'get'])
    const [namespace, method] = handler.split(':');
    
    // Access the IPC handler through window.api
    const apiNamespace = (window.api as any)[namespace];
    
    if (!apiNamespace || typeof apiNamespace[method] !== 'function') {
      throw new Error(`Handler ${handler} not found`);
    }
    
    // Call the IPC handler with provided arguments
    const result = await apiNamespace[method](...args);
    
    if (result && !result.success && result.error) {
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
  tagTypes: [
    'Apps',
    'Entity',
    'Task',
    'Issue',
    'Connections',
    'Account',
    'Spaces',
    'AppSettings',
    'Providers',
    'ProviderModels',
    'ProviderCommands',
    'ProviderSkills',
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
    'Stats',
    'WorkspaceActivity',
    'Automations',
  ],
  endpoints: () => ({}),
});
