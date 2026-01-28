import type { IssueWithEntity } from "@/lib/redux/api";

interface IssueListItemProps {
  issue: IssueWithEntity;
  isActive: boolean;
  onClick: () => void;
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

export function IssueListItem({
  issue,
  isActive,
  onClick,
}: IssueListItemProps) {
  const { issue: iss, entity } = issue;
  const labels = parseLabels(iss.labels);
  const title = entity.title || `Issue #${iss.number ?? "?"}`;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-200 ease-out flex items-start gap-2 group hover:scale-[1.01] active:scale-[0.99] ${
        isActive
          ? "bg-primary/80 dark:bg-primary/5"
          : "bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
      }`}
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline pb-1">
          <span className="text-xs text-primary-900 dark:text-primary-100 truncate">
            {title}
          </span>
        </div>

        {(labels.length > 0 || iss.assignee) && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {labels.map((label) => (
              <span
                key={label}
                className="inline-block px-1.5 py-0 text-[10px] rounded-full bg-primary-200 dark:bg-primary-500/40 text-primary-600 dark:text-primary-100"
              >
                {label}
              </span>
            ))}
            {iss.assignee && (
              <span className="text-[10px] text-primary-400 dark:text-primary-200 ml-auto">
                {iss.assignee}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
