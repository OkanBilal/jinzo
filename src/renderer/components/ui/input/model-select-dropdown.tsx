import { RefObject } from "react";
import { Button } from "../button";
import DropdownWrapper from "../dropdown-wrapper";
import { useClickOutside } from "@/hooks/use-click-outside";
import { getModelIcon } from "@/lib/model-icons";
import { ModelLoader } from "./model-loader";
import { ArrowUp } from "../icons";

interface ModelSelectDropdownProps {
  model: string;
  models: string[];
  onModelChange: (model: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
  isLoading?: boolean;
  variant?: "claude" | "copilot" | "codex" | "cursor";
}

/** Shorten Claude's generic model aliases into branded names. */
function formatClaudeModelName(model: string): string {
  const lower = model.toLowerCase();
  if (lower === "default (recommended)" || lower === "default" || lower === "opus") return "Claude Opus 4.6";
  if (lower === "sonnet") return "Claude Sonnet 4.6";
  if (lower === "haiku") return "Claude Haiku 4.5";
  return model;
}

/**
 * Format raw Cursor model slugs into human-readable names.
 * Rules:
 *  - Brand abbreviations: gpt → GPT, claude → Claude, gemini → Gemini, etc.
 *  - Two consecutive pure-integer segments are merged as "X.Y" (e.g. "4","6" → "4.6")
 *  - Version strings already containing "." (e.g. "5.3") are kept as-is
 *  - Word segments are title-cased
 */
function formatCursorModelName(model: string): string {
  if (model === "default") return "Default";

  const BRANDS: Record<string, string> = {
    gpt: "GPT",
    claude: "Claude",
    gemini: "Gemini",
    composer: "Composer",
    grok: "Grok",
    kimi: "Kimi",
    codex: "Codex",
  };

  const parts = model.split("-");
  const brand = parts[0];
  const brandDisplay = BRANDS[brand] ?? (brand.charAt(0).toUpperCase() + brand.slice(1));
  const rest = parts.slice(1);
  const tokens: string[] = [];

  let i = 0;
  while (i < rest.length) {
    const curr = rest[i];
    const next = rest[i + 1];
    if (/^\d+$/.test(curr) && next !== undefined && /^\d+$/.test(next)) {
      tokens.push(`${curr}.${next}`);
      i += 2;
    } else {
      tokens.push(/^[\d.]/.test(curr) ? curr : curr.charAt(0).toUpperCase() + curr.slice(1));
      i++;
    }
  }

  if (tokens.length === 0) return brandDisplay;
  // GPT: join all tokens with hyphens (e.g. "GPT-5.4-Codex-Spark")
  if (brand === "gpt" && /^[\d.]/.test(tokens[0])) {
    return `${brandDisplay}-${tokens.join("-")}`;
  }
  return `${brandDisplay} ${tokens.join(" ")}`;
}

function formatDisplayName(model: string, variant?: string): string {
  if (variant === "claude") return formatClaudeModelName(model);
  if (variant === "cursor") return formatCursorModelName(model);
  return model;
}

export function ModelSelectDropdown({
  model,
  models,
  onModelChange,
  isOpen,
  onToggle,
  onClose,
  dropdownRef,
  openUpward = false,
  isLoading = false,
  variant,
}: ModelSelectDropdownProps) {
  const modelList = (Array.isArray(models) ? models : []).filter(
    (m) => !(variant === "cursor" && m.toLowerCase() === "default"),
  );
  const noModels = !isLoading && modelList.length === 0;
  const displayModel = formatDisplayName(model, variant);

  useClickOutside(dropdownRef, () => {
    if (isOpen && onClose) {
      onClose();
    }
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex cursor-pointer items-center hover:bg-primary-200/30 animate-blur-reveal dark:hover:bg-primary-800 transition-colors rounded-2xl">
        <Button
          tooltip={noModels ? "No models available" : "Select model"}
          tooltipPosition="top"
          type="button"
          onClick={noModels ? undefined : onToggle}
          className={`text-sm font-medium px-2 py-1.5 flex items-center gap-1.5 ${
            noModels
              ? "text-primary-400 dark:text-primary-600 cursor-not-allowed"
              : "cursor-pointer text-primary-700 dark:text-primary-300"
          }`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          disabled={noModels || (isLoading && !displayModel)}
        >
          {isLoading && !displayModel ? (
            <ModelLoader />
          ) : noModels ? (
            <span>No models found</span>
          ) : (
            <>
              {getModelIcon(displayModel)}
              {displayModel}
              <ArrowUp className={`size-3.5 rotate-180 `} />
            </>
          )}
        </Button>
      </div>

      <DropdownWrapper
        isOpen={isOpen}
        openUpward={openUpward}
        minWidth="min-w-48"
        useFixedBackground={true}
      >
        <div className="max-h-80 overflow-auto noscrollbar ">
          {modelList.map((m) => {
            const displayName = formatDisplayName(m, variant);
            return (
              <Button
                key={m}
                type="button"
                onClick={() => {
                  onModelChange(m);
                  onToggle();
                }}
                className={`w-full text-left px-2.5 py-2 cursor-pointer text-sm transition-colors flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl ${
                  model === m
                    ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-700 dark:text-primary-300 font-medium"
                    : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
                }`}
              >
                {getModelIcon(displayName)}
                {displayName}
              </Button>
            );
          })}
        </div>
      </DropdownWrapper>
    </div>
  );
}
