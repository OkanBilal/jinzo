import { Plus } from "@/components/ui/icons";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";

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

function parseLabels(labels: string | null): string[] {
  if (!labels) return [];
  try {
    const parsed = JSON.parse(labels);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
 // TODO: move to
function getLabelColor(label: string): string {
  const labelLower = label.toLowerCase();

  const labelColors: Record<string, string> = {
    // Type labels
    bug: "bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-300",
    fix: "bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-300",
    feature:
      "bg-purple-500/20 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300",
    enhancement:
      "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300",
    improvement:
      "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300",
    documentation:
      "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-300",
    docs: "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-300",
    refactor:
      "bg-cyan-500/20 text-cyan-700 dark:bg-cyan-500/30 dark:text-cyan-300",
    test: "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-300",
    testing:
      "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-300",

    // Priority labels
    critical: "bg-red-600/20 text-red-800 dark:bg-red-600/30 dark:text-red-200",
    urgent:
      "bg-orange-500/20 text-orange-700 dark:bg-orange-500/30 dark:text-orange-300",
    high: "bg-orange-500/20 text-orange-700 dark:bg-orange-500/30 dark:text-orange-300",
    medium:
      "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-300",
    low: "bg-gray-500/20 text-gray-700 dark:bg-gray-500/30 dark:text-gray-300",

    // Status labels
    "in progress":
      "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300",
    "in-progress":
      "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300",
    blocked: "bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-300",
    "needs review":
      "bg-purple-500/20 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300",
    ready:
      "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-300",

    // Other common labels
    security: "bg-red-600/20 text-red-800 dark:bg-red-600/30 dark:text-red-200",
    performance:
      "bg-orange-500/20 text-orange-700 dark:bg-orange-500/30 dark:text-orange-300",
    ui: "bg-pink-500/20 text-pink-700 dark:bg-pink-500/30 dark:text-pink-300",
    ux: "bg-pink-500/20 text-pink-700 dark:bg-pink-500/30 dark:text-pink-300",
    design:
      "bg-pink-500/20 text-pink-700 dark:bg-pink-500/30 dark:text-pink-300",
    backend:
      "bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-300",
    frontend:
      "bg-teal-500/20 text-teal-700 dark:bg-teal-500/30 dark:text-teal-300",
    api: "bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-300",
    database:
      "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300",
    devops:
      "bg-slate-500/20 text-slate-700 dark:bg-slate-500/30 dark:text-slate-300",
    infrastructure:
      "bg-slate-500/20 text-slate-700 dark:bg-slate-500/30 dark:text-slate-300",
  };

  // Check for exact match
  if (labelColors[labelLower]) {
    return labelColors[labelLower];
  }

  // Check for partial match (e.g., "bug: something" or "type: feature")
  for (const [key, color] of Object.entries(labelColors)) {
    if (labelLower.includes(key)) {
      return color;
    }
  }

  // Default color
  return "bg-primary-200 dark:bg-primary-500/40 text-primary-600 dark:text-primary-100";
}

function ProviderIcon({ provider }: { provider: string }) {
  const iconClass = "w-5 h-5";

  switch (provider) {
    case "github":
      return <Github className={iconClass} />;
    case "linear":
      return <Linear className={iconClass} />;
    default:
      return (
        <span className="text-[9px] font-medium">
          {provider.slice(0, 2).toUpperCase()}
        </span>
      );
  }
}

function ProviderBadge({ provider }: { provider: string }) {
  const bgConfig =
    {
      github: "bg-gray-600",
      linear: "bg-purple-600",
    }[provider] || "bg-gray-500";

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
      onClick={handleClick}
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
