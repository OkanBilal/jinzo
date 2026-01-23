import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toastStore, toast as toastApi } from "./toast";
import type { Toast, ToastType } from "./types";
import { Button } from "../ui/button";

interface ToastItemProps {
  toast: Toast;
  index: number;
  onDismiss: (id: string) => void;
}

function SuccessIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path
        d="M13.5 4.5L6.5 11.5L3 8"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path
        d="M12 4L4 12M4 4L12 12"
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoadingIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 animate-spin"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M14 8a6 6 0 00-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getDefaultIcon(type: ToastType) {
  switch (type) {
    case "success":
      return <SuccessIcon />;
    case "error":
      return <ErrorIcon />;
    case "loading":
      return <LoadingIcon />;
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
      <span className="text-sm font-medium whitespace-nowrap">{toast.message}</span>
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
      {toast.dismissible && toast.type !== "loading" && (
        <Button
          onClick={handleDismiss}
          className="ml-1 -mr-1 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label="Dismiss toast"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
      )}
    </div>
  );
}

export function Toaster() {
  const toasts = useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getSnapshot,
    toastStore.getSnapshot
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
