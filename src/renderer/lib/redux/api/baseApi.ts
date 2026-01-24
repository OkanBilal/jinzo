import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';

// Custom base query that uses Electron IPC instead of HTTP
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
    
    // Check if the result has an error
    if (result && !result.success && result.error) {
      return { error: result.error };
    }
    
    // Return the data
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
    'Chat',
    'ChatConfig',
    'Entity',
    'Task',
    'Issue',
    'Playlist',
    'Feed',
    'Models',
    'Ollama',
    'Connections',
    'Account',
    'Moods',
    'AppSettings',
    'McpTools',
    'Journal',
    'Providers',
    'Tools',
    'ToolCalls',
    'ToolPermissions',
    'Workspaces',
    'Runs',
    'RunContext',
    'RunArtifacts',
    'RunCommands',
  ],
  endpoints: () => ({}),
});
