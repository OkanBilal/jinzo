import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export interface StreamingEvent {
  id: string;
  type: "artifact";
  content: string;
  streamId: string;
  timestamp: number;
}

interface StreamState {
  content: string;
  streamId: string;
  lastTs: number;
}

/**
 * Hook that subscribes to ephemeral streaming events from the main process.
 * Returns a list of synthetic events that can be merged with DB-backed events
 * for real-time text rendering.
 */
export function useStreamingEvents(activeRunId: string | null) {
  const streamsRef = useRef(new Map<string, StreamState>());
  const snapshotRef = useRef<StreamingEvent[]>([]);
  const listenersRef = useRef(new Set<() => void>());
  const throttleRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  const notify = useCallback(() => {
    const events: StreamingEvent[] = [];
    for (const [, state] of streamsRef.current) {
      if (state.content) {
        events.push({
          id: `stream-${state.streamId}`,
          type: "artifact",
          content: state.content,
          streamId: state.streamId,
          timestamp: state.lastTs,
        });
      }
    }
    snapshotRef.current = events;
    for (const listener of listenersRef.current) listener();
  }, []);

  useEffect(() => {
    const streams = streamsRef.current;
    const listeners = listenersRef.current;

    if (!activeRunId) {
      streams.clear();
      snapshotRef.current = [];
      for (const listener of listeners) listener();
      return;
    }

    const cleanup = window.api.runs.onStreamingEvent((data) => {
      if (data.runId !== activeRunId) return;

      const { event, ts } = data;
      const streamId = event.streamId;
      if (!streamId) return;

      streamsRef.current.set(streamId, {
        content: event.content ?? "",
        streamId,
        lastTs: ts,
      });

      // Throttle to ~60fps
      if (!throttleRef.current) {
        throttleRef.current = requestAnimationFrame(() => {
          throttleRef.current = null;
          notify();
        });
      }
    });

    return () => {
      cleanup();
      if (throttleRef.current) {
        cancelAnimationFrame(throttleRef.current);
        throttleRef.current = null;
      }
      streams.clear();
      snapshotRef.current = [];
      for (const listener of listeners) listener();
    };
  }, [activeRunId, notify]);

  const streamingEvents = useSyncExternalStore(subscribe, getSnapshot);

  const clearAllStreams = useCallback(() => {
    streamsRef.current.clear();
    snapshotRef.current = [];
    for (const listener of listenersRef.current) listener();
  }, []);

  return { streamingEvents, clearAllStreams };
}
