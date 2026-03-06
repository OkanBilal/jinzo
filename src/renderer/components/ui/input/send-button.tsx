import { Button } from "@/components/ui/button";
import { ChevronUp, Stop } from "@/components/ui/icons";

interface SendButtonProps {
  loading: boolean;
  onSubmit: () => void;
  onStop?: () => void;
  disabled?: boolean;
}

export function SendButton({ loading, onSubmit, onStop, disabled = false }: SendButtonProps) {
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
        <Stop className="w-5 h-5 text-primary-900" />
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
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-900 border-t-transparent" />
        </span>
      )}
      <ChevronUp
        className={`w-5 h-5 text-primary-900 transition-opacity ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      />
    </Button>
  );
}
