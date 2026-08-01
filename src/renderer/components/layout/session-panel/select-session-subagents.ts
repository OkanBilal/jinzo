import type { ToolCall } from "@/lib/redux/api";

export type SubagentState = "running" | "done" | "failed" | "stopped";

export interface SessionSubagent {
  /** Tool-call row id — stable across refetches, used as the list key. */
  id: number;
  /** Agent type as the provider named it ("general-purpose", "Explore", …). */
  agentType: string;
  /** One-line task description, when the provider supplied one. */
  description?: string;
  state: SubagentState;
}

/**
 * Wire names of the tools that spawn a subagent. Claude names this tool in two
 * layers that disagree — the registry calls it `Task`, the emitted `tool_use`
 * blocks call it `Agent` — so both count. Used only as a fallback: a call that
 * already carries `metadata.subagent` / `metadata.task` is classified from that.
 */
const SUBAGENT_TOOL_NAMES = new Set(["agent", "task"]);

interface TaskMeta {
  phase?: string;
  status?: string;
  description?: string;
  subagentType?: string;
  taskType?: string;
  error?: string;
}

interface SubagentMeta {
  phase?: string;
  agentType?: string;
  prompt?: string;
  error?: string;
}

function firstLine(text: string | undefined): string | undefined {
  const line = text?.trim().split("\n")[0]?.trim();
  return line || undefined;
}

function stateOf(
  call: ToolCall,
  task: TaskMeta | undefined,
  subagent: SubagentMeta | undefined,
): SubagentState {
  if (task?.error || task?.status === "failed" || subagent?.phase === "failed") {
    return "failed";
  }
  if (call.status === "error") return "failed";
  if (task?.status === "stopped" || task?.status === "killed") return "stopped";
  if (call.status === "canceled") return "stopped";
  if (
    task?.phase === "completed" ||
    task?.status === "completed" ||
    subagent?.phase === "completed" ||
    call.status === "done"
  ) {
    return "done";
  }
  return "running";
}

/**
 * Pick the subagents out of a run's tool calls.
 *
 * A subagent leaves three possible traces on the tool call that spawned it —
 * `metadata.subagent` (its own lifecycle), `metadata.task` (the task the CLI
 * runs it as), and the tool name itself. Older runs, or a run whose task events
 * never landed, only have the last one, so all three are consulted.
 *
 * Backgrounded shell commands are tasks too (`taskType: "local_bash"`), and
 * they are explicitly not subagents — they are filtered out here rather than in
 * the view, so the panel's count matches its list.
 *
 * Returned newest-first (by row id, which is monotonic — `createdAt` is
 * second-grained and ties): in a long session the agents still running are the
 * ones worth seeing without expanding the list.
 */
export function selectSessionSubagents(calls: ToolCall[]): SessionSubagent[] {
  const out: SessionSubagent[] = [];

  for (const call of calls) {
    const task = call.metadata?.task as TaskMeta | undefined;
    const subagent = call.metadata?.subagent as SubagentMeta | undefined;
    const input = (call.input ?? {}) as Record<string, unknown>;

    // A declared non-agent task type (a backgrounded shell command) settles it;
    // otherwise any one of the three traces is enough. `taskType` only rides on
    // the `task_started` event, so its absence proves nothing either way.
    if (task?.taskType && task.taskType !== "local_agent") continue;
    const isSubagent =
      !!subagent ||
      !!task?.subagentType ||
      task?.taskType === "local_agent" ||
      SUBAGENT_TOOL_NAMES.has(call.toolName.toLowerCase());
    if (!isSubagent) continue;

    const agentType =
      subagent?.agentType ||
      task?.subagentType ||
      (typeof input.subagent_type === "string" ? input.subagent_type : undefined) ||
      "subagent";

    const description =
      task?.description ||
      (typeof input.description === "string" ? input.description : undefined) ||
      firstLine(subagent?.prompt);

    out.push({
      id: call.id,
      agentType,
      description,
      state: stateOf(call, task, subagent),
    });
  }

  return out.sort((a, b) => b.id - a.id);
}
