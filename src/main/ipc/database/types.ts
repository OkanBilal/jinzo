export interface EntityQueryOptions {
  kind?: string;
  connectionId?: string;
  limit?: number;
}

export interface TaskQueryOptions {
  status?: "todo" | "doing" | "done" | "canceled";
  limit?: number;
}

export interface IssueQueryOptions {
  provider?: string;
  state?: string;
  limit?: number;
}

export interface FeedQueryOptions {
  eventType?: string;
  itemType?: string;
  limit?: number;
}

export interface DatabaseStats {
  entities: number;
  tasks: number;
  issues: number;
  feedEvents: number;
  chatSessions: number;
  connections: number;
}
