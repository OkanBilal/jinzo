import { Fragment, type ComponentType, type SVGProps } from "react";
import { useNavigate } from "react-router-dom";
import {
  Apps,
  Branch,
  Github,
  Mcp,
  PullRequest,
} from "@/components/ui/icons";

type SuggestionAction =
  | { type: "prompt"; value: string }
  | { type: "navigate"; to: string };

interface SpaceSuggestion {
  id: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  action: SuggestionAction;
}

export type SpaceSuggestionVariant =
  | "claude"
  | "copilot"
  | "codex"
  | "cursor";

const SUGGESTIONS: Record<SpaceSuggestionVariant, SpaceSuggestion[]> = {
  claude: [
    {
      id: "claude-review",
      icon: Branch,
      label: "Review my recent commits for correctness risks and maintainability concerns",
      action: {
        type: "prompt",
        value:
          "Review my recent commits for correctness risks and maintainability concerns.",
      },
    },
    {
      id: "claude-pr",
      icon: PullRequest,
      label: "Unblock my most recent open PR",
      action: {
        type: "prompt",
        value: "Take a look at my most recent open PR and help me unblock it.",
      },
    },
    {
      id: "claude-connect",
      icon: Apps,
      label: "Connect your favorite apps to Claude",
      action: { type: "navigate", to: "/settings?section=connections" },
    },
  ],
  codex: [
    {
      id: "codex-review",
      icon: Branch,
      label: "Review my recent commits for correctness risks and maintainability concerns",
      action: {
        type: "prompt",
        value:
          "Review my recent commits for correctness risks and maintainability concerns.",
      },
    },
    {
      id: "codex-pr",
      icon: PullRequest,
      label: "Unblock my most recent open PR",
      action: {
        type: "prompt",
        value: "Take a look at my most recent open PR and help me unblock it.",
      },
    },
    {
      id: "codex-plugins",
      icon: Mcp,
      label: "Connect your favorite apps to Codex",
      action: { type: "navigate", to: "/settings?section=codex-plugins" },
    },
  ],
  copilot: [
    {
      id: "copilot-review",
      icon: Branch,
      label: "Review my recent commits for correctness risks and maintainability concerns",
      action: {
        type: "prompt",
        value:
          "Review my recent commits for correctness risks and maintainability concerns.",
      },
    },
    {
      id: "copilot-pr",
      icon: PullRequest,
      label: "Unblock my most recent open PR",
      action: {
        type: "prompt",
        value: "Take a look at my most recent open PR and help me unblock it.",
      },
    },
    {
      id: "copilot-connect",
      icon: Github,
      label: "Connect Copilot to your GitHub account",
      action: { type: "navigate", to: "/settings?section=copilot" },
    },
  ],
  cursor: [
    {
      id: "cursor-review",
      icon: Branch,
      label: "Review my recent commits for correctness risks and maintainability concerns",
      action: {
        type: "prompt",
        value:
          "Review my recent commits for correctness risks and maintainability concerns.",
      },
    },
    {
      id: "cursor-pr",
      icon: PullRequest,
      label: "Unblock my most recent open PR",
      action: {
        type: "prompt",
        value: "Take a look at my most recent open PR and help me unblock it.",
      },
    },
    {
      id: "cursor-connect",
      icon: Apps,
      label: "Connect your favorite apps to Cursor",
      action: { type: "navigate", to: "/settings?section=connections" },
    },
  ],
};

interface SpaceSuggestionsProps {
  variant: SpaceSuggestionVariant;
  onSelectPrompt: (prompt: string) => void;
}

export function SpaceSuggestions({
  variant,
  onSelectPrompt,
}: SpaceSuggestionsProps) {
  const navigate = useNavigate();
  const items = SUGGESTIONS[variant] || [];
  if (items.length === 0) return null;

  const handleClick = (suggestion: SpaceSuggestion) => {
    if (suggestion.action.type === "prompt") {
      onSelectPrompt(suggestion.action.value);
    } else {
      navigate(suggestion.action.to);
    }
  };

  return (
    <div className="flex flex-col w-full px-1">
      {items.map((suggestion, index) => {
        const IconComp = suggestion.icon;
        return (
          <Fragment key={suggestion.id}>
            {index > 0 && (
              <div className="border-t border-primary-200/60 dark:border-primary-800/50" />
            )}
            <button
              type="button"
              onClick={() => handleClick(suggestion)}
              className="group flex items-center gap-2 py-2 text-s text-left text-primary-600 dark:text-primary-300 hover:text-primary-900 dark:hover:text-primary transition-colors cursor-pointer"
            >
              <IconComp className="size-3.5 shrink-0 text-primary-500 dark:text-primary-400 group-hover:text-primary-900 dark:group-hover:text-primary" />
              <span className="truncate">{suggestion.label}</span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
