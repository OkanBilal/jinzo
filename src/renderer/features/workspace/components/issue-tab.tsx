import { Asana, Close, Gitlab, Jira } from "@/components/ui/icons";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";
import type { IssueWithEntity } from "@/lib/redux/api";

interface IssueTabProps {
  issue: IssueWithEntity;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  variant?: "workspace" | "claude";
}

function ProviderIcon({ provider }: { provider: string }) {
  const iconClass = "w-4 h-4 shrink-0";

  switch (provider) {
    case "github":
      return <Github className={iconClass} />;
    case "linear":
      return <Linear className={iconClass} />;
    case "jira":
      return <Jira className={iconClass} />;
    case "asana":
      return <Asana className={iconClass} />;
    case "gitlab":
      return <Gitlab className={iconClass} />;
    default:
      return (
        <svg className={iconClass} viewBox="0 0 16 16" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9 0a1 1 0 11-2 0 1 1 0 012 0z"
          />
        </svg>
      );
  }
}

export function IssueTab({ issue, isActive, onClick, onClose, variant }: IssueTabProps) {
  const { issue: iss, entity } = issue;
  const label =
    iss.number != null
      ? `#${iss.number} ${entity.title || ""}`
      : entity.title || "Issue";

  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 pl-3 pr-1 py-2.5 cursor-pointer transition-colors min-w-40 max-w-48 ${
        isActive
          ? `text-primary-950 dark:text-primary-200  ${variant=== "claude" ? "dark:bg-claude-dark bg-primary" : variant === "workspace" ? " dark:bg-copilot-dark bg-primary" : ""} `  
          : "text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 "
      }`}
    >
      <ProviderIcon provider={iss.provider} />
      <span className="text-xs font-medium truncate flex-1">{label}</span>
      <button
        onClick={onClose}
        className="opacity-0 group-hover:opacity-100 p-0.5 mr-1 hover:bg-primary/10 cursor-pointer rounded transition-all"
      >
        <Close className="w-3 h-3" />
      </button>
    </div>
  );
}
