import type { RunEvent } from "../types";

export interface EventGroup {
  id: string;
  type: "tool_calls" | "info" | "response";
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
      currentToolGroup.push(event);
    } else if (event.type === "artifact") {
      flushToolGroup();
      // Determine if this is a user prompt or response
      const isUserPrompt = event.metadata?.kind === "user-prompt";
      groups.push({
        id: `${isUserPrompt ? "user" : "response"}-${event.id}`,
        type: isUserPrompt ? "info" : "response",
        events: [event],
        startTime: event.timestamp,
        endTime: event.timestamp,
      });
    } else if (event.type === "log") {
      // Skip start/resume level logs (internal system messages)
      const level = event.metadata?.level as string | undefined;
      if (level === "start" || level === "resume") {
        continue;
      }
      //TODO: We might want to show error logs in a special way instead of skipping them - for now we just skip to reduce noise
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
