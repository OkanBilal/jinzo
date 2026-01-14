import Text, { Body, Caption } from "@/components/ui/text";
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
  primaryButtonVariant = "primary",
}: AlertProps) {
  if (!isOpen) return null;

  const primaryButtonClasses =
    primaryButtonVariant === "danger"
      ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white"
      : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 "
      onClick={onSecondary}
    >
      <div
      style={{
        animation: "scaleIn 150ms ease-out",
      }}
        className="rounded-3xl p-6
    bg-linear-to-b from-white/70 to-primary-50/60 dark:from-primary-900/80 dark:to-primary-900/20 
    backdrop-blur-[20px] saturate-180  border border-white/40 dark:border-white/8 
    shadow-[0_2px_8px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] 
    dark:shadow-[0_2px_8px_rgba(0,0,0,0.25),0_4px_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.16)] max-w-75 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <Body className="text-primary-900 dark:text-primary-100 font-semibold mb-4 ">
          {title}
        </Body>
        <Text className="text-primary-700 text-2xl dark:text-primary-400 ">
          {description}
        </Text>
        <div className="flex gap-3 mt-4">
          <Button
            className="flex-1 rounded-full"
            variant="secondary"
            onClick={onSecondary}
            disabled={isPrimaryLoading}
          >
            {secondaryButtonText}
          </Button>
          <Button
            className="flex-1 rounded-full"
            variant="primary"
            onClick={onPrimary}
            disabled={isPrimaryLoading}
          >
            {isPrimaryLoading ? "Loading..." : primaryButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
