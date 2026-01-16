
export type PromptItem = { label: string; imageSrc: string };


export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

export type EntityRow = {
  id: string;
  title: string;
  url: string;
  body: string | null;
  summary: string | null;
  kind: string;
  occurredAt: string;
  connectionId: string | null;
  resourceId: string | null;
  externalId: string | null;
  metadata?: JSONValue | null;
};

/**
 * @deprecated Use EntityRow instead
 */
export type FeedRow = {
  title: string;
  url: string;
  description: string | null;
  itemType: string | null;
  date: string;
  source: string;
  imageUrl: string | null;
  metadata?: JSONValue | null;
};

export type PromptBuilder = (entities: EntityRow[]) => PromptItem[];


export function parseMetadata(raw: unknown): Record<string, any> | undefined {
  if (!raw) return undefined;
  
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  
  if (typeof raw === "object" && raw !== null) {
    return raw as Record<string, any>;
  }
  
  return undefined;
}
