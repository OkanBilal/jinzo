import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdateJournalDraftMutation } from "@/lib/redux/api";

interface AutosaveOptions {
  debounceMs?: number;
  maxWaitMs?: number;
}

interface AutosaveState {
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
}

interface AutosavePayload {
  title?: string;
  body?: string;
  summary?: string;
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 8000;

/**
 * Hook for debounced autosave of journal entries.
 *
 * - Debounces writes to DB when user is idle for debounceMs (default 1200ms)
 * - Forces a save after maxWaitMs (default 8000ms) even if still typing
 * - Flushes on blur/unmount
 * - Returns flush function for explicit save button
 */
export function useJournalAutosave(
  entityId: string | null,
  options: AutosaveOptions = {}
) {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, maxWaitMs = DEFAULT_MAX_WAIT_MS } = options;

  const [updateDraft] = useUpdateJournalDraftMutation();

  const [state, setState] = useState<AutosaveState>({
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    error: null,
  });

  // Refs for tracking
  const pendingPayloadRef = useRef<AutosavePayload | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChangeTimeRef = useRef<number>(0);
  const isSavingRef = useRef<boolean>(false);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
  }, []);

  // Actual save function
  const performSave = useCallback(async () => {
    if (!entityId || !pendingPayloadRef.current || isSavingRef.current) {
      return;
    }

    const payload = pendingPayloadRef.current;
    pendingPayloadRef.current = null;
    isSavingRef.current = true;

    setState((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      await updateDraft({ id: entityId, payload });
      setState((prev) => ({
        ...prev,
        isDirty: false,
        isSaving: false,
        lastSavedAt: new Date(),
        error: null,
      }));
    } catch (error) {
      console.error("Autosave failed:", error);
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: (error as Error).message,
      }));
      // Put the payload back so we can retry
      pendingPayloadRef.current = payload;
    } finally {
      isSavingRef.current = false;
    }
  }, [entityId, updateDraft]);

  // Queue a change for autosave
  const queueSave = useCallback(
    (payload: AutosavePayload) => {
      if (!entityId) return;

      // Merge with any existing pending payload
      pendingPayloadRef.current = {
        ...pendingPayloadRef.current,
        ...payload,
      };

      setState((prev) => ({ ...prev, isDirty: true }));

      const now = Date.now();

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set up debounce timer
      debounceTimerRef.current = setTimeout(() => {
        performSave();
        clearTimers();
      }, debounceMs);

      // Set up max wait timer if not already set
      if (!maxWaitTimerRef.current) {
        lastChangeTimeRef.current = now;
        maxWaitTimerRef.current = setTimeout(() => {
          performSave();
          clearTimers();
        }, maxWaitMs);
      }
    },
    [entityId, debounceMs, maxWaitMs, performSave, clearTimers]
  );

  // Force flush (for explicit save or blur)
  const flush = useCallback(async () => {
    clearTimers();
    if (pendingPayloadRef.current) {
      await performSave();
    }
  }, [clearTimers, performSave]);

  // Handle window blur
  useEffect(() => {
    const handleBlur = () => {
      flush();
    };

    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
    };
  }, [flush]);

  // Handle beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingPayloadRef.current) {
        // Try to save synchronously (best effort)
        flush();
        // Show warning if still dirty
        if (state.isDirty) {
          e.preventDefault();
          e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
          return e.returnValue;
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [flush, state.isDirty]);

  // Cleanup on unmount or entityId change
  useEffect(() => {
    return () => {
      // Flush any pending changes
      if (pendingPayloadRef.current && entityId) {
        // Perform a synchronous-ish save on unmount
        const payload = pendingPayloadRef.current;
        pendingPayloadRef.current = null;
        // Fire and forget - we're unmounting
        updateDraft({ id: entityId, payload }).catch(console.error);
      }
      clearTimers();
    };
  }, [entityId, updateDraft, clearTimers]);

  // Reset state when entityId changes
  useEffect(() => {
    setState({
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
      error: null,
    });
    pendingPayloadRef.current = null;
    clearTimers();
  }, [entityId, clearTimers]);

  return {
    queueSave,
    flush,
    ...state,
  };
}
