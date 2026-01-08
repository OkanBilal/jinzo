

export interface ChatSession {
  id: number;
  title: string | null;
  initialQuery: string | null;
  model: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: number;
  sessionId: number;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  createdAt: Date;
}

export interface ChatSessionListResponse {
  sessions: ChatSession[];
}

export interface ChatMessageListResponse {
  messages: Array<{
    id: number;
    role: string;
    content: string;
    createdAt: Date;
  }>;
}

export interface SessionRouteParams {
  params: Promise<{
    id: string;
  }>;
}



