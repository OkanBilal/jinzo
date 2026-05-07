import type { RunEvent } from "../types";

export interface EventGroup {
  id: string;
  type: "tool_calls" | "info" | "response" | "prompt_suggestion";
  events: RunEvent[];
  startTime: Date;
  endTime: Date;
  isRunning?: boolean;
}

/** Tool events rendered as PlanDisplay — same name rules as `groupEvents` standalone plan groups. */
function toolEventPlanName(event: { type: string; content: string }): string | null {
  if (event.type !== "tool_call") return null;
  const colonIdx = event.content.indexOf(":");
  return (colonIdx !== -1 ? event.content.substring(0, colonIdx).trim() : event.content).toLowerCase();
}

function isPlanToolEvent(event: { type: string; content: string }): boolean {
  const n = toolEventPlanName(event);
  return n === "plan" || n === "exitplanmode" || n === "create plan";
}

/**
 * Codex AgentControl collab tool calls (spawn/sendInput/wait/close/resume) —
 * render standalone outside the tool_calls accordion so each transition shows
 * up clearly in the timeline ("Spawned X", "Finished waiting for X", etc.).
 */
const COLLAB_TOOL_NAMES = new Set([
  "spawnagent",
  "sendcollabinput",
  "waitcollabagent",
  "closecollabagent",
  "resumecollabagent",
]);

function isStandaloneToolEvent(event: { type: string; content: string }): boolean {
  const n = toolEventPlanName(event);
  return n !== null && COLLAB_TOOL_NAMES.has(n);
}

export function isPlanToolCallGroup(group: EventGroup): boolean {
  if (group.type !== "tool_calls") return false;
  return group.events.some((ev) => isPlanToolEvent(ev));
}

export function groupEvents(events: RunEvent[]): EventGroup[] {
  const groups: EventGroup[] = [];
  let currentToolGroup: RunEvent[] = [];

  const flushToolGroup = () => {
    if (currentToolGroup.length > 0) {
      groups.push({
        id: `tools-${currentToolGroup[0].id}`,
        type: "tool_calls",
        events: [...currentToolGroup],
        startTime: currentToolGroup[0].timestamp,
        endTime: currentToolGroup[currentToolGroup.length - 1].timestamp,
      });
      currentToolGroup = [];
    }
  };

  for (const event of events) {
    if (event.type === "tool_call") {
      // Plan/ExitPlanMode tool calls render standalone, never inside a group
      if (isPlanToolEvent(event)) {
        flushToolGroup();
        groups.push({
          id: `plan-${event.id}`,
          type: "tool_calls",
          events: [event],
          startTime: event.timestamp,
          endTime: event.timestamp,
        });
      } else if (isStandaloneToolEvent(event)) {
        // Codex spawnAgent calls — keep each one as its own group so subagent
        // info is visible and not collapsed inside the tool_calls accordion.
        flushToolGroup();
        groups.push({
          id: `standalone-${event.id}`,
          type: "tool_calls",
          events: [event],
          startTime: event.timestamp,
          endTime: event.timestamp,
        });
      } else {
        currentToolGroup.push(event);
      }
    } else if (event.type === "artifact") {
      flushToolGroup();
      // Cursor agent thought stream — UI-only (e.g. loader), not a chat bubble
      if (event.metadata?.kind === "thinking") {
        continue;
      }
      const isUserPrompt = event.metadata?.kind === "user-prompt";
      const isPromptSuggestion = event.metadata?.kind === "prompt_suggestion";

      if (isPromptSuggestion) {
        // Merge consecutive suggestions into one group
        const lastGroup = groups[groups.length - 1];
        if (lastGroup?.type === "prompt_suggestion") {
          lastGroup.events.push(event);
          lastGroup.endTime = event.timestamp;
        } else {
          groups.push({
            id: `suggestion-${event.id}`,
            type: "prompt_suggestion",
            events: [event],
            startTime: event.timestamp,
            endTime: event.timestamp,
          });
        }
      } else {
        groups.push({
          id: `${isUserPrompt ? "user" : "response"}-${event.id}`,
          type: isUserPrompt ? "info" : "response",
          events: [event],
          startTime: event.timestamp,
          endTime: event.timestamp,
        });
      }
    } else if (event.type === "log") {
      // Skip start/resume level logs (internal system messages)
      const level = event.metadata?.level as string | undefined;
      if (level === "start" || level === "resume") {
        continue;
      }
      if (level === "error") {
        continue;
      }

      // SDK user messages - show as special info group
      if (level === "sdk-user") {
        flushToolGroup();
        groups.push({
          id: `sdk-user-${event.id}`,
          type: "info",
          events: [event],
          startTime: event.timestamp,
          endTime: event.timestamp,
        });
        continue;
      }

      // Check if this is a system/info log we want to show
      const content = event.content;
      const isImportant =
        content.includes("Session initialized") ||
        content.includes("Starting") ||
        content.includes("Resuming") ||
        (!content.startsWith("[") && content.length < 200);

      if (isImportant) {
        flushToolGroup();
        groups.push({
          id: `info-${event.id}`,
          type: "info",
          events: [event],
          startTime: event.timestamp,
          endTime: event.timestamp,
        });
      }
      // Skip non-important logs (they're internal)
    } else if (event.type === "status") {
      // Status events are important
      flushToolGroup();
      groups.push({
        id: `status-${event.id}`,
        type: "info",
        events: [event],
        startTime: event.timestamp,
        endTime: event.timestamp,
      });
    }
  }

  // Flush any remaining tool calls (and mark as running if at the end)
  if (currentToolGroup.length > 0) {
    groups.push({
      id: `tools-${currentToolGroup[0].id}`,
      type: "tool_calls",
      events: [...currentToolGroup],
      startTime: currentToolGroup[0].timestamp,
      endTime: currentToolGroup[currentToolGroup.length - 1].timestamp,
      isRunning: true, // Last group might still be running
    });
  }

  return groups;
}
