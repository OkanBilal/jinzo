import { baseApi } from './baseApi';

export interface Automation {
  id: string;
  accountId: string;
  name: string;
  kind: 'sync' | 'report' | 'cleanup' | 'custom';
  action: string;
  intervalMinutes: number;
  isActive: boolean;
  config: string | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastError: string | null;
  consecutiveErrors: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAutomationInput {
  name: string;
  kind: Automation['kind'];
  action: string;
  intervalMinutes: number;
  isActive?: boolean;
  config?: string | null;
}

export interface UpdateAutomationInput {
  name?: string;
  kind?: Automation['kind'];
  action?: string;
  intervalMinutes?: number;
  isActive?: boolean;
  config?: string | null;
}

export const automationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAutomations: builder.query<Automation[], void>({
      query: () => ({ handler: 'automations:getAll' }),
      transformResponse: (response: any) =>
        response.success ? response.data : [],
      providesTags: ['Automations'],
    }),

    createAutomation: builder.mutation<
      Automation,
      { accountId: string; input: CreateAutomationInput }
    >({
      query: ({ accountId, input }) => ({
        handler: 'automations:create',
        args: [accountId, input],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: ['Automations'],
    }),

    updateAutomation: builder.mutation<
      Automation,
      { id: string; input: UpdateAutomationInput }
    >({
      query: ({ id, input }) => ({
        handler: 'automations:update',
        args: [id, input],
      }),
      transformResponse: (response: any) =>
        response.success ? response.data : null,
      invalidatesTags: ['Automations'],
    }),

    deleteAutomation: builder.mutation<void, string>({
      query: (id) => ({
        handler: 'automations:delete',
        args: [id],
      }),
      invalidatesTags: ['Automations'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAutomationsQuery,
  useLazyGetAutomationsQuery,
  useCreateAutomationMutation,
  useUpdateAutomationMutation,
  useDeleteAutomationMutation,
} = automationsApi;
