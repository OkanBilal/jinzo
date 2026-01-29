// ─────────────────────────────────────────────────────────────
// Workspace Resources DTOs
// ─────────────────────────────────────────────────────────────

export interface WorkspaceResource {
  id: string;
  workspaceId: string;
  resourceId: string;
  createdAt: Date;
}

export interface WorkspaceResourceWithDetails extends WorkspaceResource {
  resource: {
    id: string;
    connectionId: string;
    externalId: string;
    kind: string;
    name: string | null;
    url: string | null;
    metadata: string | null;
  };
}

export interface AvailableResource {
  id: string;
  connectionId: string;
  externalId: string;
  kind: string;
  name: string | null;
  url: string | null;
  metadata: string | null;
  isLinked: boolean;
}

export interface AddResourcePayload {
  workspaceId: string;
  resourceId: string;
}

export interface RemoveResourcePayload {
  workspaceId: string;
  resourceId: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
