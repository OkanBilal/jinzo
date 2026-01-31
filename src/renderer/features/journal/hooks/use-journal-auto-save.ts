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

  const pendingPayloadRef = useRef<AutosavePayload | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChangeTimeRef = useRef<number>(0);
  const isSavingRef = useRef<boolean>(false);

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
      pendingPayloadRef.current = payload;
    } finally {
      isSavingRef.current = false;
    }
  }, [entityId, updateDraft]);

  const queueSave = useCallback(
    (payload: AutosavePayload) => {
      if (!entityId) return;
      pendingPayloadRef.current = {
        ...pendingPayloadRef.current,
        ...payload,
      };

      setState((prev) => ({ ...prev, isDirty: true }));

      const now = Date.now();

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        performSave();
        clearTimers();
      }, debounceMs);
      debounceTimerRef.current = setTimeout(() => {
        performSave();
        clearTimers();
      }, debounceMs);

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

  const flush = useCallback(async () => {
    clearTimers();
    if (pendingPayloadRef.current) {
      await performSave();
    }
  }, [clearTimers, performSave]);

  useEffect(() => {
    const handleBlur = () => {
      flush();
    };

    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
    };
  }, [flush]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingPayloadRef.current) {
        flush();
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

  useEffect(() => {
    return () => {
      if (pendingPayloadRef.current && entityId) {
        const payload = pendingPayloadRef.current;
        pendingPayloadRef.current = null;
        // Fire and forget - we're unmounting
        updateDraft({ id: entityId, payload }).catch(console.error);
      }
      clearTimers();
    };
  }, [entityId, updateDraft, clearTimers]);

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
