import { Button } from "@/components/ui/button";
import { ChevronUp, Stop } from "@/components/ui/icons";

export type InputVariant = "default" | "copilot" | "claude";

interface SendButtonProps {
  loading: boolean;
  onSubmit: () => void;
  onStop?: () => void;
  variant?: InputVariant;
  disabled?: boolean;
}

const variantStyles = {
  default: {
    spinner: "border-primary-900",
    icon: "text-primary-900",
    stop: "text-primary-900",
  },
  copilot: {
    spinner: "border-copilot-blue",
    icon: "text-copilot-blue",
    stop: "text-copilot-blue",
  },
  claude: {
    spinner: "border-claude-dark",
    icon: "text-claude-dark",
    stop: "text-claude-dark",
  },
};

export function SendButton({ loading, onSubmit, onStop, variant = "default", disabled = false }: SendButtonProps) {
  const styles = variantStyles[variant];
  const isDisabled = loading || disabled;

  if (loading && onStop) {
    return (
      <Button
        type="button"
        tooltip="Stop run"
        onClick={onStop}
        className="metallic-button relative"
        aria-label="Stop run"
      >
        <Stop className={`w-5 h-5 ${styles.stop}`} />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      tooltip="Send a message"
      onClick={() => {
        if (!isDisabled) onSubmit();
      }}
      className={`metallic-button relative ${
        isDisabled ? "opacity-70 cursor-not-allowed" : ""
      }`}
      aria-label={loading ? "Submitting..." : "Send prompt"}
      disabled={isDisabled}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className={`h-4 w-4 animate-spin rounded-full border-2 ${styles.spinner} border-t-transparent`} />
        </span>
      )}
      <ChevronUp
        className={`w-5 h-5 ${styles.icon} transition-opacity ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      />
    </Button>
  );
}
