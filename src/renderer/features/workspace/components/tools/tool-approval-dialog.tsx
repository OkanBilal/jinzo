import { useState, useCallback } from "react";
import { Question } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import type { ToolApprovalRequest } from "../../hooks";
import { ToolInputPreview } from "./tool-input-preview";

interface ToolApprovalDialogProps {
  request: ToolApprovalRequest;
  onRespond: (requestId: string, approved: boolean, answer?: string) => void;
}

export function ToolApprovalDialog({
  request,
  onRespond,
}: ToolApprovalDialogProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");

  const handleAllow = useCallback(() => {
    onRespond(request.requestId, true);
  }, [request.requestId, onRespond]);

  const handleDeny = useCallback(() => {
    onRespond(request.requestId, false);
  }, [request.requestId, onRespond]);

  const handleSubmitAnswer = useCallback(() => {
    let answer: string;
    if (selectedOptions.length > 0) {
      answer = selectedOptions.join(", ");
    } else if (freeText.trim()) {
      answer = freeText.trim();
    } else {
      return; // nothing selected
    }
    onRespond(request.requestId, true, answer);
  }, [request.requestId, selectedOptions, freeText, onRespond]);

  const toggleOption = useCallback(
    (label: string) => {
      if (request.multiSelect) {
        setSelectedOptions((prev) =>
          prev.includes(label)
            ? prev.filter((o) => o !== label)
            : [...prev, label],
        );
      } else {
        setSelectedOptions((prev) => (prev.includes(label) ? [] : [label]));
      }
    },
    [request.multiSelect],
  );

  if (request.kind === "ask_user") {
    return (
      <div className="mx-auto max-w-210 px-4 mb-4">
        <div className="rounded-xl  border border-primary-200/20 dark:border-primary-700/30 bg-primary-50/50 dark:bg-primary/3 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Question className="size-4 text-primary-400 mt-0.5 shrink-0" />
            <div className="space-y-3 flex-1 min-w-0">
              <p className="text-sm text-primary-200 dark:text-primary-300 font-medium">
                {request.question || "Claude is asking a question"}
              </p>

              {request.options && request.options.length > 0 && (
                <div className="space-y-1.5">
                  {request.options.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => toggleOption(opt.label)}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors border ${
                        selectedOptions.includes(opt.label)
                          ? "border-primary-400/50 bg-primary-400/10 text-primary-200"
                          : "border-primary-200/10 dark:border-primary-700/20 hover:border-primary-400/30 text-primary-300 dark:text-primary-400"
                      }`}
                    >
                      <span className="font-medium">{opt.label}</span>
                      {opt.description && (
                        <span className="ml-1.5 text-primary-400 dark:text-primary-500">
                          {opt.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmitAnswer();
                  }}
                  placeholder="Type a custom answer..."
                  className="flex-1 bg-primary-100/50 dark:bg-primary-800/30 border border-primary-200/20 dark:border-primary-700/30 rounded-md px-3 py-1.5 text-xs text-primary-200 dark:text-primary-300 placeholder:text-primary-400 dark:placeholder:text-primary-500 focus:outline-none focus:border-primary-400/50"
                />
                <Button
                  variant="primary"
                  size="sm"
                  className="min-w-16"
                  onClick={handleSubmitAnswer}
                  disabled={selectedOptions.length === 0 && !freeText.trim()}
                >
                  Submit
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-w-16"
                  onClick={handleDeny}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // tool_approval mode
  return (
    <div className="mr-auto max-w-160 mb-4">
      <div className=" space-y-3 bg-primary-50/50 dark:bg-primary/3 rounded-xl p-5 ">
        <div className="flex items-start gap-2">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary-200 dark:text-primary-300 mb-2">
                Tool approval required
              </span>
              <span className="px-1.5 py-0.5 mb-2 rounded text-[11px] bg-primary-200/10 dark:bg-primary/10 text-primary-300 dark:text-primary-400">
                {request.toolName}
              </span>
            </div>

            <ToolInputPreview
              toolName={request.toolName}
              toolInput={request.toolInput}
            />

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                className="min-w-16"
                onClick={handleAllow}
              >
                Allow
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="min-w-16"
                onClick={handleDeny}
              >
                Deny
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
