import type { RunEvent } from "../types";

export interface EventGroup {
  id: string;
  type: "tool_calls" | "info" | "response" | "prompt_suggestion";
  events: RunEvent[];
  startTime: Date;
  endTime: Date;
  isRunning?: boolean;
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
      const colonIdx = event.content.indexOf(":");
      const name = (colonIdx !== -1 ? event.content.substring(0, colonIdx).trim() : event.content).toLowerCase();
      if (name === "plan" || name === "exitplanmode" || name === "create plan") {
        flushToolGroup();
        groups.push({
          id: `plan-${event.id}`,
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
