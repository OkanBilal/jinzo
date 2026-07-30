import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { Button } from "./button";
import { Close } from "./icons";
import { useSuppressBrowserView } from "@/hooks/use-suppress-browser-view";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Panel overrides — sizing (w-*, max-w-*) and radius. */
  className?: string;
  /** "dim" matches Alert/WizardModal; "media" darkens + blurs for image/screenshot previews. */
  backdrop?: "dim" | "media";
}

/**
 * Shared modal shell: portal, backdrop click-to-close, Escape key, entrance
 * animation, and native-browser-view suppression (the embedded browser panel
 * paints above DOM content, so it must be hidden while any overlay is open).
 * Content is free-form; pair with ModalHeader for the standard title bar.
 */
export function Modal({
  isOpen,
  onClose,
  children,
  className,
  backdrop = "dim",
}: ModalProps) {
  useSuppressBrowserView(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4">
      <div
        className={cn(
          "absolute inset-0",
          backdrop === "media"
            ? "bg-black/70 backdrop-blur-sm"
            : "dark:bg-primary-950/60 bg-primary/80",
        )}
        role="presentation"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex flex-col glass-surface rounded-3xl overflow-hidden max-h-[92vh]",
          className,
        )}
        style={{
          animation: "wizardModalIn 250ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ModalHeaderProps {
  onClose: () => void;
  children: ReactNode;
}

/** Standard modal title bar: content on the left, close button on the right. */
export function ModalHeader({ onClose, children }: ModalHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2  shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">{children}</div>
      <Button
        onClick={onClose}
        aria-label="Close"
        className="ml-3 shrink-0 p-1.5 rounded-full glass-button hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors cursor-pointer"
      >
        <Close className="size-4 text-primary-500" />
      </Button>
    </div>
  );
}
