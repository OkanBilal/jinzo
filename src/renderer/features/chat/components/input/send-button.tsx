import { ChevronUp } from "../../../../components/ui/icons";

import { SendButtonProps } from "./types";

export default function SendButton({ loading, onSubmit }: SendButtonProps) {
  return (
    <button
      type="button"
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
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-900 border-t-transparent" />
        </span>
      )}
      <ChevronUp
        className={`w-6 h-6 text-primary-900 transition-opacity ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      />
    </button>
  );
}
