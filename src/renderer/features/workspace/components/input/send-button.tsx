import { Button } from "@/components/ui/button";
import { ChevronUp } from "../../../../components/ui/icons";


export default function SendButton({ loading, onSubmit }: SendButtonProps) {
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
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-copilot-blue border-t-transparent" />
        </span>
      )}
      <ChevronUp
        className={`w-5 h-5 text-copilot-blue transition-opacity ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      />
    </Button>
  );
}

interface SendButtonProps {
  loading: boolean;
  onSubmit: () => void;
}