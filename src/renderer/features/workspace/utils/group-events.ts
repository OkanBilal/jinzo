import type { RunEvent } from "../types";
import { eventsValueEqual } from "./run-event-mappers";

export interface EventGroup {
  id: string;
  type: "tool_calls" | "info" | "response" | "prompt_suggestion";
  events: RunEvent[];
  startTime: Date;
  endTime: Date;
  isRunning?: boolean;
}

/** Tool events rendered as PlanDisplay — same name rules as `groupEvents` standalone plan groups. */
export function toolEventPlanName(event: { type: string; content: string }): string | null {
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
      const isImage = event.metadata?.kind === "image";

      if (isImage) {
        // Merge consecutive image artifacts into one group so multiple
        // generated images render side by side as a gallery row.
        const lastGroup = groups[groups.length - 1];
        const lastIsImageGroup =
          lastGroup?.type === "response" &&
          lastGroup.events[0]?.type === "artifact" &&
          lastGroup.events[0]?.metadata?.kind === "image";
        if (lastIsImageGroup) {
          lastGroup.events.push(event);
          lastGroup.endTime = event.timestamp;
        } else {
          groups.push({
            id: `response-${event.id}`,
            type: "response",
            events: [event],
            startTime: event.timestamp,
            endTime: event.timestamp,
          });
        }
      } else if (isPromptSuggestion) {
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

function eventGroupsEqual(a: EventGroup, b: EventGroup): boolean {
  if (a === b) return true;
  if (
    a.id !== b.id ||
    a.type !== b.type ||
    a.isRunning !== b.isRunning ||
    a.events.length !== b.events.length ||
    a.endTime.getTime() !== b.endTime.getTime()
  ) {
    return false;
  }
  for (let i = 0; i < a.events.length; i++) {
    // `eventsValueEqual` compares rebuilt object metadata by value, so a tool
    // event re-mapped from an unchanged row still reads equal (and the group is
    // reused) instead of forcing a spurious re-render.
    if (!eventsValueEqual(a.events[i], b.events[i])) return false;
  }
  return true;
}

/**
 * Structural sharing for grouped events. `groupEvents` rebuilds every group
 * object on each call, so a single streamed token would otherwise hand every
 * row a brand-new `group` prop and defeat `React.memo`. This reuses the prior
 * call's group objects (matched by stable `id`) wherever the content is
 * unchanged, so only the groups that actually changed get a fresh reference —
 * and the whole array reference is preserved when nothing changed at all.
 */
export function reconcileEventGroups(
  prev: EventGroup[] | null,
  next: EventGroup[],
): EventGroup[] {
  if (!prev || prev.length === 0) return next;
  const prevById = new Map<string, EventGroup>();
  for (const g of prev) prevById.set(g.id, g);

  let changed = prev.length !== next.length;
  const out: EventGroup[] = new Array(next.length);
  for (let i = 0; i < next.length; i++) {
    const g = next[i];
    const p = prevById.get(g.id);
    if (p && eventGroupsEqual(p, g)) {
      out[i] = p; // reuse the stable reference
      if (p !== prev[i]) changed = true; // same content but order shifted
    } else {
      out[i] = g;
      changed = true;
    }
  }
  return changed ? out : prev;
}
