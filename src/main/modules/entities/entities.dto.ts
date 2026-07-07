// ─────────────────────────────────────────────────────────────
// Entity DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateEntityPayload {
  accountId: string;
  kind: string;
  connectionId?: string;
  resourceId?: string;
  externalId?: string;
  url?: string;
  title?: string;
  body?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface UpdateEntityPayload {
  title?: string;
  body?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  url?: string;
  isDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Task DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateTaskPayload {
  entity: CreateEntityPayload;
  status?: "todo" | "doing" | "done" | "canceled";
  dueAt?: Date;
  priority?: number;
  labels?: string[];
}

export interface UpdateTaskPayload {
  status?: "todo" | "doing" | "done" | "canceled";
  dueAt?: Date | null;
  priority?: number;
  labels?: string[];
}

// ─────────────────────────────────────────────────────────────
// Issue DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateIssuePayload {
  entity: CreateEntityPayload;
  provider: string;
  state: string;
  number?: number;
  repo?: string;
  assignee?: string;
  labels?: string[];
  priority?: number;
}

export interface UpdateIssuePayload {
  state?: string;
  assignee?: string;
  labels?: string[];
  priority?: number;
  closedAt?: Date | null;
}

// ─────────────────────────────────────────────────────────────
// Signal DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateSignalPayload {
  entity: CreateEntityPayload;
  source: string;
  level?: "fatal" | "critical" | "error" | "warning" | "info";
  category?: "crash" | "bug" | "alert" | "feedback" | "exception" | "other";
  state?: "open" | "resolved" | "ignored" | "regressed";
  eventCount?: number;
  affectedUsers?: number;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  stackTrace?: string;
  file?: string;
  function?: string;
  line?: number;
  assignee?: string;
  labels?: string[];
  priority?: number;
  projectId?: string;
}

export interface UpdateSignalPayload {
  level?: "fatal" | "critical" | "error" | "warning" | "info";
  category?: "crash" | "bug" | "alert" | "feedback" | "exception" | "other";
  state?: "open" | "resolved" | "ignored" | "regressed";
  eventCount?: number;
  affectedUsers?: number;
  lastSeenAt?: Date;
  stackTrace?: string;
  file?: string;
  function?: string;
  line?: number;
  assignee?: string;
  labels?: string[];
  priority?: number;
  projectId?: string;
  resolvedAt?: Date | null;
}

export interface SignalQueryOptions {
  source?: string;
  level?: string;
  category?: string;
  state?: string;
  projectId?: string;
  limit?: number;
}

// ─────────────────────────────────────────────────────────────
// Query Options
// ─────────────────────────────────────────────────────────────
export interface EntityQueryOptions {
  kinds?: string[];
  kind?: string;
  connectionIds?: string[];
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
  repo?: string;
  limit?: number;
}

export interface SearchOptions {
  kind?: string;
  limit?: number;
}

