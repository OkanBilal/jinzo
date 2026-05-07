import { Bot } from "@/components/ui/icons";

export interface SpawnAgentSubAgent {
  threadId: string;
  nickname?: string;
  role?: string;
  status?: string;
}

export interface SpawnAgentParams {
  prompt?: string;
  model?: string;
  receiverThreadIds?: string[];
}

/**
 * Codex's collab tool variants. Determines the verb shown in the timeline
 * ("Spawned", "Finished waiting for", "Closed", etc.). Falls back to
 * `spawnAgent` semantics when omitted (older runs persisted before the
 * variant was tracked).
 */
export type CollabAgentVariant =
  | "spawnAgent"
  | "sendInput"
  | "wait"
  | "closeAgent"
  | "resumeAgent";

export interface SpawnAgentOutput {
  subAgents?: SpawnAgentSubAgent[];
  prompt?: string;
  model?: string;
  collabTool?: CollabAgentVariant;
}

const NICKNAME_COLORS = [
  "text-emerald-500 dark:text-emerald-400",
  "text-amber-500 dark:text-amber-400",
  "text-sky-500 dark:text-sky-400",
  "text-violet-500 dark:text-violet-400",
  "text-rose-500 dark:text-rose-400",
  "text-teal-500 dark:text-teal-400",
];

function colorFor(name: string | undefined, fallbackIdx: number): string {
  const seed = name && name.length > 0 ? name.charCodeAt(0) + (name.charCodeAt(name.length - 1) || 0) : fallbackIdx;
  return NICKNAME_COLORS[seed % NICKNAME_COLORS.length];
}

function formatRole(role: string | undefined): string {
  if (!role) return "";
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}

/**
 * Use the high-entropy tail of a UUIDv7 instead of the first 8 chars: codex
 * spawns parallel sub-threads within milliseconds of each other, so their
 * timestamp-prefixed IDs collide on the first 12 hex chars. The last segment
 * after the final dash is fully random.
 */
function shortId(id: string): string {
  const lastDash = id.lastIndexOf("-");
  if (lastDash === -1) return id.length > 8 ? id.slice(-8) : id;
  const tail = id.slice(lastDash + 1);
  return tail.length > 8 ? tail.slice(0, 8) : tail;
}

function verbForVariant(variant: CollabAgentVariant | undefined): string {
  switch (variant) {
    case "wait":
      return "Finished waiting for";
    case "closeAgent":
      return "Closed";
    case "sendInput":
      return "Sent input to";
    case "resumeAgent":
      return "Resumed";
    case "spawnAgent":
    default:
      return "Spawned";
  }
}

export function SpawnAgentDisplay({
  output,
  toolName,
}: {
  output?: unknown;
  /** Lowercased toolName from the parent ToolCallItem dispatch. */
  toolName?: string;
}) {
  const parsedOutput =
    typeof output === "string"
      ? safeJsonParse<SpawnAgentOutput>(output)
      : (output as SpawnAgentOutput | undefined);

  // Prefer the variant carried in the output payload; fall back to inferring
  // from toolName so old runs (no collabTool field persisted) still render.
  const variant: CollabAgentVariant =
    parsedOutput?.collabTool ??
    (toolName === "sendcollabinput" ? "sendInput"
      : toolName === "waitcollabagent" ? "wait"
      : toolName === "closecollabagent" ? "closeAgent"
      : toolName === "resumecollabagent" ? "resumeAgent"
      : "spawnAgent");

  const subAgents = parsedOutput?.subAgents ?? [];
  const hasSubs = subAgents.length > 0;
  const verb = verbForVariant(variant);

  if (!hasSubs) return null;

  return (
    <div className="flex flex-col">
      {subAgents.map((sub, idx) => {
        const label = sub.nickname ?? shortId(sub.threadId);
        const role = formatRole(sub.role);
        return (
          <div
            key={sub.threadId}
            className="flex items-center gap-1.5 py-0.5 text-s text-primary-500 dark:text-primary-300"
          >
            <Bot className="size-3.5 shrink-0" />
            <span>{verb}</span>
            <span className={`font-medium ${colorFor(label, idx)}`}>{label}</span>
            {role && <span className="text-primary-400 dark:text-primary-400">{role}</span>}
          </div>
        );
      })}
    </div>
  );
}

function safeJsonParse<T>(s: string): T | undefined {
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}
