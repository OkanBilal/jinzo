import { baseApi } from './baseApi';

export interface ChatSession {
  id: number;
  title: string | null;
  initialQuery: string | null;
  createdAt: number;
  model: string | null;
  updatedAt: string;
}
export interface ChatMessage {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  metadata?: string;
  createdAt: number;
}

export interface CreateSessionPayload {
  question: string;
  model: string;
}

export interface CreateSessionResponse {
  sessionId: number;
}

export interface StructuredOutputProperty {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  isArray: boolean;
  isRequired: boolean;
}

export interface StructuredOutputSchema {
  properties: StructuredOutputProperty[];
}

export interface ChatConfig {
  temperature: number;
  top_p: number;
  topK: number;
  minScore: number;
  selectedModel: string;
  toolMode: 'chat' | 'rag' | 'mcp';
  structuredOutputEnabled: boolean;
  structuredOutputSchema: StructuredOutputSchema;
}

export const chatApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    
    getChatConfig: builder.query<ChatConfig, void>({
      query: () => ({
        handler: 'chat:getConfig',
      }),
      transformResponse: (response: any) => response.success ? response.data : null,
      providesTags: ['ChatConfig'],
    }),
    
    updateChatConfig: builder.mutation<ChatConfig, Partial<ChatConfig>>({
      query: (body) => ({
        handler: 'chat:updateConfig',
        args: [body],
      }),
      transformResponse: (response: any) => response.success ? response.data : null,
      invalidatesTags: ['ChatConfig'],
    }),

    createChatSession: builder.mutation<CreateSessionResponse, CreateSessionPayload>({
      query: (body) => ({
        handler: 'chat:createSession',
        args: [body],
      }),
      transformResponse: (response: any) => response.success ? response.data : null,
      invalidatesTags: ['Chat'],
    }),

    getChatSession: builder.query<ChatSession, number>({
      query: (sessionId) => ({
        handler: 'chat:getSessionById',
        args: [sessionId],
      }),
      transformResponse: (response: any) => response.success ? response.data : null,
      providesTags: (_result, _error, sessionId) => [{ type: 'Chat', id: sessionId }],
    }),

    getChatMessages: builder.query<ChatMessage[], number>({
      query: (sessionId) => ({
        handler: 'chat:getMessages',
        args: [sessionId],
      }),
      transformResponse: (response: any) => 
        response.success ? response.data.messages : [],
      providesTags: (_result, _error, sessionId) => [
        { type: 'Chat', id: `${sessionId}-messages` },
      ],
    }),

    getChatSessions: builder.query<ChatSession[], void>({
      query: () => ({
        handler: 'chat:getSessions',
      }),
      transformResponse: (response: any) => 
        response.success ? response.data.sessions : [],
      providesTags: ['Chat'],
    }),

    deleteChatSession: builder.mutation<{ success: boolean }, number>({
      query: (sessionId) => ({
        handler: 'chat:deleteSession',
        args: [sessionId],
      }),
      invalidatesTags: ['Chat'],
    }),

    updateChatSessionTitle: builder.mutation<{ title: string }, { sessionId: number; title: string }>({
      query: ({ sessionId, title }) => ({
        handler: 'chat:updateTitle',
        args: [sessionId, title],
      }),
      transformResponse: (response: any) => response.success ? response.data : null,
      invalidatesTags: ['Chat'],
    }),

    generateChatSessionTitle: builder.mutation<{ title: string }, { sessionId: number; model?: string }>({
      query: ({ sessionId, model }) => ({
        handler: 'chat:generateTitle',
        args: [sessionId, model],
      }),
      transformResponse: (response: any) => response.success ? response.data : null,
      invalidatesTags: (_result, _error, { sessionId }) => [
        'Chat',
        { type: 'Chat', id: sessionId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetChatConfigQuery,
  useUpdateChatConfigMutation,
  useCreateChatSessionMutation,
  useGetChatSessionQuery,
  useGetChatMessagesQuery,
  useGetChatSessionsQuery,
  useDeleteChatSessionMutation,
  useUpdateChatSessionTitleMutation,
  useGenerateChatSessionTitleMutation,
} = chatApi;
