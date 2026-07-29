import type { cues } from "../../db/schema";

export type Cue = typeof cues.$inferSelect;
export type CueKind = Cue["kind"];
export type CueStatus = Cue["status"];

export type CreateCueInput = {
  projectId: string;
  sourceWorkspaceId?: string | null;
  kind?: CueKind;
  title?: string | null;
  content: string;
  status?: CueStatus;
  isPinned?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
};

export type UpdateCueInput = Partial<
  Pick<
    Cue,
    | "sourceWorkspaceId"
    | "kind"
    | "title"
    | "content"
    | "status"
    | "isPinned"
    | "sortOrder"
  >
> & {
  metadata?: Record<string, unknown> | null;
};
