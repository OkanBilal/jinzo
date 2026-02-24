// ─────────────────────────────────────────────────────────────
// Project Resources DTOs
// ─────────────────────────────────────────────────────────────

export interface ProjectResource {
  id: string;
  projectId: string;
  resourceId: string;
  createdAt: Date;
}

export interface ProjectResourceWithDetails extends ProjectResource {
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
  projectId: string;
  resourceId: string;
}

export interface RemoveResourcePayload {
  projectId: string;
  resourceId: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
