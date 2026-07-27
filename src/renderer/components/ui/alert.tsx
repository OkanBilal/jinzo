import { createPortal } from "react-dom";
import { Body, Label } from "./text";
import { Button } from "@/components/ui/button";
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
}

export default function Alert({
  isOpen,
  title,
  description,
  primaryButtonText,
  secondaryButtonText,
  onPrimary,
  onSecondary,
  isPrimaryLoading = false,
}: AlertProps) {
  // Hide the native browser view while open so this alert isn't trapped behind it.
  useSuppressBrowserView(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-(--z-modal-critical) flex items-center justify-center bg-primary-950/50 "
      role="presentation"
      onClick={onSecondary}
    >
      <div
        className="rounded-4xl p-6 glass-surface max-w-84 w-full animate-dropdown-in origin-center"
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
        <div className="flex gap-3 mt-6">
          <Button
            className="flex-1 rounded-full font-semibold"
            variant="danger"
            onClick={onPrimary}
            disabled={isPrimaryLoading}
          >
            {isPrimaryLoading ? "Loading..." : primaryButtonText}
          </Button>
          <Button
            className="flex-1 rounded-full font-semibold"
            variant="primary"
            onClick={onSecondary}
            disabled={isPrimaryLoading}
          >
            {secondaryButtonText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
