import Text, { Body } from "./text";
import { Button } from "./button";

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
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-(--z-overlay) flex items-center justify-center bg-primary-950/55 "
      role="presentation"
      onClick={onSecondary}
    >
      <div
        className="rounded-4xl px-6 pt-5 pb-6 glass-morphism max-w-80 w-full animate-dropdown-in origin-center"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Body className="text-primary-900 dark:text-primary-100 font-semibold mb-3 ">
          {title}
        </Body>
        <Text className="text-primary-700 text-sm dark:text-primary-400 ">
          {description}
        </Text>
        <div className="flex gap-3 mt-4">
          <Button
            className="flex-1 rounded-full font-semibold"
            variant="danger"
            size="md"
            onClick={onPrimary}
            disabled={isPrimaryLoading}
          >
            {isPrimaryLoading ? "Loading..." : primaryButtonText}
          </Button>
          <Button
            className="flex-1 rounded-full font-semibold"
            variant="primary"
            size="md"
            onClick={onSecondary}
            disabled={isPrimaryLoading}
          >
            {secondaryButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
