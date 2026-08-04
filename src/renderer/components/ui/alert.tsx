import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Body, Label } from "./text";
import { Button } from "@/components/ui/button";
import { Enter } from "./icons";
import { useSuppressBrowserView } from "@/hooks/use-suppress-browser-view";

interface AlertProps {
  isOpen: boolean;
  title: string;
  description: string;
  primaryButtonText: string;
  secondaryButtonText: string;
  onPrimary: () => void;
  onSecondary: () => void;
  isPrimaryLoading?: boolean;
  primaryButtonVariant?: "primary" | "danger";
  /**
   * Extra content between the description and the buttons — an opt-in the
   * confirmation itself carries, such as "also remove the directory". Enter
   * still fires the primary action, so anything focusable here must not need
   * Enter of its own.
   */
  children?: ReactNode;
}

/**
 * Keyboard affordances for the two buttons, mirroring the handlers below.
 * The return glyph rides bare on the loud primary button; esc gets a keycap
 * outline so it still reads as a key on the quiet one.
 */
const EnterHint = () => (
  <kbd className="flex items-center opacity-80">
    <Enter className="size-4" />
  </kbd>
);

const EscHint = () => (
  <kbd className="rounded-md border border-current/50 px-0.5 py-px font-sans text-[8px] font-medium  opacity-60">
    ESC
  </kbd>
);

export default function Alert({
  isOpen,
  title,
  description,
  primaryButtonText,
  secondaryButtonText,
  onPrimary,
  onSecondary,
  isPrimaryLoading = false,
  children,
}: AlertProps) {
  // Hide the native browser view while open so this alert isn't trapped behind it.
  useSuppressBrowserView(isOpen);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Pull focus off whatever was behind the backdrop (a branch-rename input, a
  // settings field), so Enter/Escape belong to the alert and not to it.
  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  // Capture phase: the panel below stops keydown propagation, which would
  // otherwise swallow these before they reach a bubble-phase window listener.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      // Both buttons are disabled mid-action; the keys follow them.
      if (isPrimaryLoading) return;
      if (e.key === "Enter") onPrimary();
      else onSecondary();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen, isPrimaryLoading, onPrimary, onSecondary]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-(--z-modal-critical) flex items-center justify-center bg-primary-950/50 "
      role="presentation"
      onClick={onSecondary}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="rounded-4xl p-6 glass-surface max-w-90 w-full animate-dropdown-in origin-center focus:outline-none"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Body className="mb-2 font-medium">
          {title}
        </Body>
        <Label className="font-normal text-s ">
          {description}
        </Label>
        {children && <div className="mt-4">{children}</div>}
        <div className="flex gap-3 mt-6">
          <Button
            className="flex-1 rounded-full font-semibold"
            variant="danger"
            onClick={onPrimary}
            disabled={isPrimaryLoading}
          >
            {isPrimaryLoading ? (
              "Loading..."
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                {primaryButtonText}
                <EnterHint />
              </span>
            )}
          </Button>
          <Button
            className="flex-1 rounded-full font-semibold"
            variant="primary"
            onClick={onSecondary}
            disabled={isPrimaryLoading}
          >
            <span className="flex items-center justify-center gap-2">
              {secondaryButtonText}
              <EscHint />
            </span>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
