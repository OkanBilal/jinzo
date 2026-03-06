import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Body, Button, Textarea } from "@/components/ui";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  if (!isOpen) return null;
  return <FeedbackModalContent onClose={onClose} />;
}

function FeedbackModalContent({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleSend = async () => {
    if (!message.trim() || status === "loading") return;
    setStatus("loading");
    setErrorText("");

    try {
      const result = await window.api.feedback.send({ message: message.trim() });
      if (result.success) {
        setStatus("success");
        setTimeout(onClose, 1500);
      } else {
        setStatus("error");
        setErrorText(result.error || "Something went wrong");
      }
    } catch {
      setStatus("error");
      setErrorText("Something went wrong");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/55"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="rounded-4xl px-6 pt-5 pb-6 glass-morphism max-w-md w-full animate-dropdown-in origin-center"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Body className="text-primary-900 dark:text-primary-100 font-semibold mb-4">
          Send Feedback
        </Body>

        {status === "success" ? (
          <p className="text-sm text-green-600 dark:text-green-400 py-4 text-center">
            Thanks for your feedback!
          </p>
        ) : (
          <>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's on your mind?"
              rows={4}
              className="min-w-0 mb-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) handleSend();
              }}
            />

            {status === "error" && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1 mb-1">
                {errorText}
              </p>
            )}

            <div className="flex gap-3 mt-4">
              <Button
                className="flex-1 rounded-full! font-semibold"
                variant="secondary"
                size="md"
                onClick={onClose}
                disabled={status === "loading"}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full! font-semibold"
                variant="primary"
                size="md"
                onClick={handleSend}
                disabled={!message.trim() || status === "loading"}
              >
                {status === "loading" ? "Sending..." : "Send"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
