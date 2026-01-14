import { baseApi } from './baseApi';

export interface Account {
  id: string;
  displayName: string;
  email: string;
  company: string;
  jobTitle: string;
  timezone: string;
  locale: string;
  website: string;
  avatarUrl: string;
  bio: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface UpdateAccountPayload {
  displayName?: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  timezone?: string;
  locale?: string;
  website?: string;
  avatarUrl?: string;
  bio?: string;
}

export const accountApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAccount: builder.query<Account, void>({
      query: () => ({
        handler: 'account:get',
      }),
      transformResponse: (response: any) => response.success ? response.data : null,
      providesTags: ['Account'],
    }),

    updateAccount: builder.mutation<
      { success: boolean; data: Account },
      UpdateAccountPayload
    >({
      query: (body) => ({
        handler: 'account:update',
        args: [body],
      }),
      invalidatesTags: ['Account'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAccountQuery,
  useUpdateAccountMutation,
} = accountApi;
