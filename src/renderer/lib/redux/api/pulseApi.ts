import { baseApi } from './baseApi';

export type PulseFrequency = 'hourly' | 'daily' | 'weekdays' | 'weekly';

export interface Pulse {
  id: string;
  accountId: string;
  workspaceId: string;
  providerId: string;
  model: string;
  title: string;
  prompt: string;
  frequency: PulseFrequency;
  dayOfWeek: number | null;
  hour: number;
  minute: number;
  timezone: string;
  thinkingMode: boolean;
  effortLevel: string | null;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastRunId: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePulseInput {
  workspaceId: string;
  providerId: string;
  model: string;
  title: string;
  prompt: string;
  frequency: PulseFrequency;
  dayOfWeek?: number | null;
  hour: number;
  minute: number;
  timezone: string;
  thinkingMode?: boolean;
  effortLevel?: string | null;
  isActive?: boolean;
}

export type UpdatePulseInput = Partial<
  Omit<CreatePulseInput, 'workspaceId' | 'providerId'>
> & {
  workspaceId?: string;
  providerId?: string;
};

export const pulseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPulses: builder.query<Pulse[], void>({
      query: () => ({ handler: 'pulse:getAll' }),
      transformResponse: (response: any) =>
        response?.success ? response.data : [],
      providesTags: ['Pulse'],
    }),

    getPulseById: builder.query<Pulse | null, string>({
      query: (id) => ({ handler: 'pulse:getById', args: [id] }),
      transformResponse: (response: any) =>
        response?.success ? response.data : null,
      providesTags: (_res, _err, id) => [{ type: 'Pulse', id }],
    }),

    createPulse: builder.mutation<
      Pulse,
      { accountId: string; input: CreatePulseInput }
    >({
      query: ({ accountId, input }) => ({
        handler: 'pulse:create',
        args: [accountId, input],
      }),
      transformResponse: (response: any) =>
        response?.success ? response.data : null,
      invalidatesTags: ['Pulse'],
    }),

    updatePulse: builder.mutation<
      Pulse,
      { id: string; input: UpdatePulseInput }
    >({
      query: ({ id, input }) => ({
        handler: 'pulse:update',
        args: [id, input],
      }),
      transformResponse: (response: any) =>
        response?.success ? response.data : null,
      invalidatesTags: ['Pulse'],
    }),

    deletePulse: builder.mutation<void, string>({
      query: (id) => ({ handler: 'pulse:delete', args: [id] }),
      invalidatesTags: ['Pulse'],
    }),

    togglePulse: builder.mutation<
      Pulse,
      { id: string; isActive: boolean }
    >({
      query: ({ id, isActive }) => ({
        handler: 'pulse:toggle',
        args: [id, isActive],
      }),
      transformResponse: (response: any) =>
        response?.success ? response.data : null,
      invalidatesTags: ['Pulse'],
    }),

    runPulseNow: builder.mutation<Pulse, string>({
      query: (id) => ({ handler: 'pulse:runNow', args: [id] }),
      transformResponse: (response: any) =>
        response?.success ? response.data : null,
      invalidatesTags: ['Pulse', 'Runs'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPulsesQuery,
  useLazyGetPulsesQuery,
  useGetPulseByIdQuery,
  useCreatePulseMutation,
  useUpdatePulseMutation,
  useDeletePulseMutation,
  useTogglePulseMutation,
  useRunPulseNowMutation,
} = pulseApi;
