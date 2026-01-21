export interface FeedQueryParams {
  connectionIds: string[];
  eventTypes: string[];
  itemTypes: string[];
  entityId?: string;
  limit: number;
}

export interface FeedQueryOptions {
  connectionIds?: string[];
  eventTypes?: string[];
  itemTypes?: string[];
  entityId?: string;
  limit?: number;
}
