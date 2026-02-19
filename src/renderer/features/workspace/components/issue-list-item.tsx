import { Asana, Gitlab, Plus } from "@/components/ui/icons";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";
import { Jira } from "@/components/ui/icons";
import { getLabelColor, parseLabels } from "@/lib/label-colors";
import { ca } from "node_modules/@linear/sdk/dist/index-BBxdiqQK.mjs";

interface IssueData {
  issue: {
    entityId: string;
    provider: string;
    state: string;
    number: number | null;
    labels: string | null;
    priority?: number | null;
  };
  entity: {
    id: string;
    title: string | null;
  };
}

interface IssueListItemProps {
  issue: IssueData;
  isActive: boolean;
  onClick: () => void;
  onAddToContext?: () => void;
}

function ProviderIcon({ provider }: { provider: string }) {
  const iconClass = "w-5 h-5 text-primary-800 dark:text-primary-300";

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
        <span className="text-[9px] font-medium">
          {provider.slice(0, 2).toUpperCase()}
        </span>
      );
  }
}

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center px-1 text-white`}
      title={provider}
    >
      <ProviderIcon provider={provider} />
    </span>
  );
}

export function IssueListItem({
  issue,
  isActive,
  onClick,
  onAddToContext,
}: IssueListItemProps) {
  const { issue: iss, entity } = issue;
  const labels = parseLabels(iss.labels);
  const title = entity.title || `Issue #${iss.number ?? "?"}`;

  const handleAddToContext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToContext?.();
  };

  const handleClick = (e: React.MouseEvent) => {
    onClick();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(e as any); } }}
      className={`w-full text-left px-1 py-1.5  rounded-lg cursor-pointer transition-all duration-200 ease-out flex items-center gap-2 group hover:scale-[1.01] active:scale-99 ${
        isActive
          ? "bg-primary/80 dark:bg-primary/5"
          : "bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
      }`}
    >
      {/* Provider badge - left, vertically centered */}
      <ProviderBadge provider={iss.provider} />

      {/* Content - title on top, labels below */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-[13px] text-primary-900 dark:text-primary-100 font-medium truncate">
          {title}
        </span>

        {labels.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {labels.map((label) => (
              <span
                key={label}
                className={`inline-block capitalize px-1.5 py-0 text-[11px] font-medium rounded-full ${getLabelColor(label)}`}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Add to context button - right, vertically centered */}
      {onAddToContext && (
        <button
          onClick={handleAddToContext}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-primary/20 dark:hover:bg-primary/10 transition-all"
          title="Add to context"
        >
          <Plus className="w-3 h-3 text-primary-500 dark:text-primary-400" />
        </button>
      )}
    </div>
  );
}
