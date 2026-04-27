import { useState, useCallback } from "react";
import { Question } from "@/components/ui/icons";
import { Button } from "@/components/ui";
import type { ToolApprovalRequest } from "../../hooks";
import { ToolInputPreview } from "./tool-input-preview";

interface ToolApprovalDialogProps {
  request: ToolApprovalRequest;
  onRespond: (requestId: string, approved: boolean, answer?: string) => void;
  variant?: "copilot" | "claude" | "codex" | "cursor";
}

export function ToolApprovalDialog({
  request,
  onRespond,
  variant,
}: ToolApprovalDialogProps) {
  const isCursor = variant === "cursor";
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");

  const handleAllow = useCallback(() => {
    onRespond(request.requestId, true);
  }, [request.requestId, onRespond]);

  const handleAllowForSession = useCallback(() => {
    onRespond(request.requestId, true, "acceptForSession");
  }, [request.requestId, onRespond]);

  const handleDeny = useCallback(() => {
    onRespond(request.requestId, false);
  }, [request.requestId, onRespond]);

  const handleSubmitAnswer = useCallback(() => {
    let answer: string;
    if (selectedOptions.length > 0) {
      answer = selectedOptions.join(", ");
    } else if (!isCursor && freeText.trim()) {
      answer = freeText.trim();
    } else {
      return;
    }
    onRespond(request.requestId, true, answer);
  }, [request.requestId, selectedOptions, freeText, isCursor, onRespond]);

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

  const canSubmit =
    selectedOptions.length > 0 ||
    (!isCursor && freeText.trim().length > 0);

  if (request.kind === "ask_user") {
    return (
      <div className="mx-auto mb-4 max-w-210 px-4">
        <div className="overflow-hidden rounded-xl  glass-morphism">
          <div className="flex gap-3 px-3.5 pb-2 pt-3.5 sm:px-4 sm:pt-4">
            <Question className="mt-0.5 size-4 shrink-0 text-primary-600 dark:text-primary-400" />
            <div className="min-w-0 flex-1 space-y-2">
              {request.multiSelect && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-primary-100/50 px-1.5 py-0.5 text-xxs font-medium text-primary-600 dark:bg-primary-900/40 dark:text-primary-400">
                    Multi-select
                  </span>
                </div>
              )}
              <p className="text-sm font-medium leading-snug text-primary-900 dark:text-primary-100">
                {request.question || "The agent is asking a question."}
              </p>
            </div>
          </div>

          {request.options && request.options.length > 0 && (
            <div className="space-y-2 px-3.5 pb-3 sm:px-4">
              {request.options.map((opt) => {
                const isSelected = selectedOptions.includes(opt.label);
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => toggleOption(opt.label)}
                    className={`flex w-full gap-2.5 rounded-lg  px-2.5 py-2.5 text-left text-xs transition-colors ${
                      isSelected
                        ? " bg-emerald-500/8  dark:bg-emerald-500/10"
                        : " bg-primary-100/30 hover:border-primary-300/70 dark:bg-primary-800/50 dark:hover:border-primary-600/50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded ${
                        isSelected
                          ? " bg-emerald-500 text-white dark:bg-emerald-600"
                          : " bg-primary-50/80 dark:border-primary-600 dark:bg-primary-900/50"
                      }`}
                      aria-hidden
                    >
                      {isSelected && (
                        <span className="text-[10px] font-bold leading-none text-white">
                          ✓
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span
                        className={`font-semibold ${
                          isSelected
                            ? "text-emerald-800 dark:text-emerald-200"
                            : "text-primary-800 dark:text-primary-200"
                        }`}
                      >
                        {opt.label}
                      </span>
                      {opt.description && (
                        <p className="mt-1 text-xxs leading-relaxed text-primary-600 dark:text-primary-400">
                          {opt.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="border-t border-primary-200/40 px-3.5 py-3 dark:border-primary-700/25 sm:px-4">
            <div
              className={`flex flex-col gap-3 sm:flex-row sm:items-end ${isCursor ? "sm:justify-end" : ""}`}
            >
              {!isCursor && (
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Custom answer</span>
                  <input
                    type="text"
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmitAnswer();
                    }}
                    placeholder="Type a custom answer…"
                    className="w-full rounded-lg bg-primary-100/50   px-3 py-2 text-xs text-primary-950 transition-colors placeholder:text-primary-500 focus:outline-none dark:bg-primary-800/50 dark:text-primary-100 dark:placeholder:text-primary-500"
                  />
                </label>
              )}
              <div className="flex shrink-0 items-center justify-end gap-2 sm:pb-px">
                <Button
                  variant="primary"
                  size="xs"
                  className="min-w-18  text-primary-700 hover:bg-primary-200/40  dark:text-primary-300 dark:hover:bg-primary-800/50"
                  onClick={handleDeny}
                >
                  Dismiss
                </Button>
                <Button
                  variant="submit"
                  size="xs"
                  className="min-w-18 font-semibold shadow-sm disabled:opacity-45"
                  onClick={handleSubmitAnswer}
                  disabled={!canSubmit}
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mr-auto mb-4 max-w-160">
      <div className="overflow-hidden rounded-xl p-4 glass-morphism">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-primary-900 dark:text-primary-100">
              Tool approval required
            </span>
            <span className="rounded-lg bg-primary-100/40 px-2 py-0.5 text-xxs font-medium capitalize text-primary-700 dark:bg-primary-800/40 dark:text-primary-300">
              {request.toolName}
            </span>
          </div>

          <ToolInputPreview
            toolName={request.toolName}
            toolInput={request.toolInput}
          />

          <div className="flex flex-wrap items-center gap-2 pt-3 ">
            <Button
              variant="submit"
              size="xs"
              className="min-w-16 font-semibold"
              onClick={handleAllow}
            >
              Allow
            </Button>
            {variant === "codex" && (
              <Button
                variant="primary"
                size="xs"
                className="min-w-16"
                onClick={handleAllowForSession}
              >
                Allow for Session
              </Button>
            )}
            <Button
              variant="secondary"
              size="xs"
              className="min-w-16 text-primary-700 hover:bg-primary-200/40  dark:text-primary-300 dark:hover:bg-primary-800/50"
              onClick={handleDeny}
            >
              Deny
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
