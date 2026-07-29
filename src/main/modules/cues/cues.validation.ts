import type { CreateCueInput, CueKind, CueStatus, UpdateCueInput } from "./cues.dto";

const CUE_KINDS: CueKind[] = ["note", "prompt", "todo"];
const CUE_STATUSES: CueStatus[] = ["inbox", "active", "done"];

function validMetadata(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "object" && !Array.isArray(value))
  );
}

export function validateCreate(input: CreateCueInput): string | null {
  if (!input.projectId?.trim()) return "projectId is required";
  if (!input.content?.trim()) return "content is required";
  if (input.kind && !CUE_KINDS.includes(input.kind)) return "Invalid Cue kind";
  if (input.status && !CUE_STATUSES.includes(input.status)) return "Invalid Cue status";
  if (input.sortOrder != null && !Number.isInteger(input.sortOrder)) {
    return "sortOrder must be an integer";
  }
  if (!validMetadata(input.metadata)) return "metadata must be an object";
  return null;
}

export function validateUpdate(input: UpdateCueInput): string | null {
  if (input.content !== undefined && !input.content.trim()) return "content cannot be empty";
  if (input.kind && !CUE_KINDS.includes(input.kind)) return "Invalid Cue kind";
  if (input.status && !CUE_STATUSES.includes(input.status)) return "Invalid Cue status";
  if (input.sortOrder != null && !Number.isInteger(input.sortOrder)) {
    return "sortOrder must be an integer";
  }
  if (input.metadata !== undefined && !validMetadata(input.metadata)) {
    return "metadata must be an object";
  }
  return null;
}
