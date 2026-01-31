import { Button } from "@/components/ui/button";
import { ChevronUp } from "@/components/ui/icons";

export type InputVariant = "default" | "copilot" | "claude";

interface SendButtonProps {
  loading: boolean;
  onSubmit: () => void;
  variant?: InputVariant;
}

const variantStyles = {
  default: {
    spinner: "border-primary-900",
    icon: "text-primary-900",
  },
  copilot: {
    spinner: "border-copilot-blue",
    icon: "text-copilot-blue",
  },
  claude: {
    spinner: "border-claude-dark",
    icon: "text-claude-dark",
  },
};

export function SendButton({ loading, onSubmit, variant = "default" }: SendButtonProps) {
  const styles = variantStyles[variant];

  return (
    <Button
      type="button"
      tooltip="Send a message"
      onClick={() => {
        if (!loading) onSubmit();
      }}
      className={`metallic-button relative ${
        loading ? "opacity-70 cursor-not-allowed" : ""
      }`}
      aria-label={loading ? "Submitting..." : "Send prompt"}
      disabled={loading}
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
