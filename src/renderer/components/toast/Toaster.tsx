import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toastStore, toast as toastApi } from "./toast";
import type { ToastItemProps, ToastType } from "./types";
import { Button } from "../ui/button";
import { Error, Success } from "../ui/icons";

function getDefaultIcon(type: ToastType) {
  switch (type) {
    case "success":
      return <Success />;
    case "error":
      return <Error />;
    default:
      return null;
  }
}

function ToastItem({ toast, index, onDismiss }: ToastItemProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const dismissedRef = useRef(false);

  // Trigger enter animation after mount
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(id);
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (toast.duration === Infinity || exiting) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (!isPaused && !dismissedRef.current) {
      timeoutId = setTimeout(() => {
        if (!dismissedRef.current) {
          setExiting(true);
        }
      }, toast.duration);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [toast.id, toast.duration, isPaused, exiting]);

  // Handle exit animation then dismiss
  useEffect(() => {
    if (exiting && !dismissedRef.current) {
      const id = setTimeout(() => {
        dismissedRef.current = true;
        onDismiss(toast.id);
      }, 200);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [exiting, toast.id, onDismiss]);

  const icon = toast.icon ?? getDefaultIcon(toast.type);

  const handleDismiss = () => {
    if (!dismissedRef.current && !exiting) {
      setExiting(true);
    }
  };

  const isVisible = mounted && !exiting;

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`
        pointer-events-auto inline-flex items-center gap-3 px-5 py-3
        rounded-full max-w-[calc(100vw-24px)]
        bg-white/90 dark:bg-primary-950
        border border-primary-200/10 dark:border-primary-900
        text-slate-900 dark:text-white
        transition-all duration-200 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"}
      `}
      style={{ zIndex: 99999 - index }}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      <span className="text-sm font-medium whitespace-nowrap">
        {toast.message}
      </span>
      {toast.action && (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            toast.action?.onClick();
            handleDismiss();
          }}
          className="text-sm font-semibold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          {toast.action.label}
        </Button>
      )}
    </div>
  );
}

export function Toaster() {
  const toasts = useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getSnapshot,
    toastStore.getSnapshot,
  );

  // Keyboard dismiss (Escape dismisses top toast)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toasts.length > 0) {
        toastApi.dismiss(toasts[0].id);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toasts]);

  const handleDismiss = useCallback((id: string) => {
    toastApi.dismiss(id);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 flex flex-col items-center pt-10 gap-2.5 pointer-events-none"
      style={{ zIndex: 99999 }}
      aria-label="Notifications"
    >
      {toasts.map((t, index) => (
        <ToastItem
          key={t.id}
          toast={t}
          index={index}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
