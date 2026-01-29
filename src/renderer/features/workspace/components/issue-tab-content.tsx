import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/features/chat/components/markdown-components";
import type { IssueWithEntity } from "@/lib/redux/api";

interface IssueTabContentProps {
  issue: IssueWithEntity;
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

export function IssueTabContent({ issue }: IssueTabContentProps) {
  const { issue: iss, entity } = issue;
  const labels = parseLabels(iss.labels);
  const isOpen = iss.state === "open";
  const title = entity.title || `Issue #${iss.number ?? "?"}`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-210 mx-auto pt-12 pb-24 px-6 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          {/* Repo + number */}
          <div className="flex items-center gap-2 text-sm text-primary-500 dark:text-primary-400">
            {iss.repo && <span className="font-mono">{iss.repo}</span>}
            {iss.number != null && (
              <span className="font-mono">#{iss.number}</span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl font-semibold text-primary-900 dark:text-primary-100">
            {title}
          </h1>

          {/* State badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isOpen
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : "bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-400"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOpen ? "bg-green-500" : "bg-primary-400"
                }`}
              />
              {iss.state}
            </span>

            {/* Assignee */}
            {iss.assignee && (
              <span className="text-xs text-primary-500 dark:text-primary-400">
                Assigned to{" "}
                <span className="font-medium text-primary-700 dark:text-primary-300">
                  {iss.assignee}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {labels.map((label) => (
              <span
                key={label}
                className="inline-block px-2.5 py-1 text-xs rounded-full bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-300 font-medium"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3 text-sm border border-primary-200 dark:border-primary-700/50 rounded-xl p-4">
          <div>
            <span className="text-primary-400 dark:text-primary-500 text-xs uppercase tracking-wider">
              Provider
            </span>
            <p className="text-primary-800 dark:text-primary-200 mt-0.5">
              {iss.provider}
            </p>
          </div>
          <div>
            <span className="text-primary-400 dark:text-primary-500 text-xs uppercase tracking-wider">
              Priority
            </span>
            <p className="text-primary-800 dark:text-primary-200 mt-0.5">
              {iss.priority}
            </p>
          </div>
          {iss.closedAt && (
            <div>
              <span className="text-primary-400 dark:text-primary-500 text-xs uppercase tracking-wider">
                Closed
              </span>
              <p className="text-primary-800 dark:text-primary-200 mt-0.5">
                {new Date(iss.closedAt).toLocaleDateString()}
              </p>
            </div>
          )}
          {entity.url && (
            <div>
              <span className="text-primary-400 dark:text-primary-500 text-xs uppercase tracking-wider">
                Link
              </span>
              <p className="mt-0.5">
                <a
                  href={entity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 dark:text-blue-400 hover:underline text-xs break-all"
                >
                  {iss.provider === "linear"
                    ? "View on Linear"
                    : iss.provider === "jira"
                      ? "View on Jira"
                      : "View on GitHub"}
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-primary-700 dark:text-primary-300">
            Description
          </h2>
          {entity.body ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {entity.body}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-primary-400 dark:text-primary-500 italic">
              Details not synced yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
