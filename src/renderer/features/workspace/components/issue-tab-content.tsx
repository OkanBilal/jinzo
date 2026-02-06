import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { markdownComponents } from "@/features/chat/components/markdown-components";
import type { IssueWithEntity } from "@/lib/redux/api";
import { Heading2 } from "@/components/ui/text";
import { getLabelColor } from "@/lib/label-colors";
import { Button } from "@/components/ui/button";

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
        <div className="space-y-3">
          {/* Title */}
          <Heading2 className="text-xl font-semibold text-primary-900 dark:text-primary-100">
            {title}{" "}
            {iss.number != null && (
              <span className="font-mono">#{iss.number}</span>
            )}
          </Heading2>

          {/* State badge */}
          <div className="flex items-center gap-3 flex-wrap">
            {iss.assignee && (
              <span className="text-sm text-primary-500 dark:text-primary-400">
                Assigned to{" "}
                <span className="font-medium text-primary-700 dark:text-primary-300">
                  {iss.assignee}
                </span>
              </span>
            )}
            <span
              className={`inline-flex capitalize items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
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
          </div>
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {labels.map((label) => (
              <span
                key={label}
                className={`inline-block px-2.5 py-1 text-xs rounded-full capitalize font-medium ${getLabelColor(label)}`}
              >
                {label}
              </span>
            ))}
          </div>
        )}
        {/* TODO: Priority will be aligned  */}
        {/* <p className="text-primary-800 dark:text-primary-200 mt-0.5">
              {iss.priority}
            </p> */}

        {/* Body */}
        <div className="space-y-2">
          {entity.body ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
              >
                {entity.body}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-primary-400 dark:text-primary-500 italic">
              Details not synced yet or no description provided.
            </p>
          )}
        </div>
        {entity.url && (
          <div>
            <p className="mt-0.5">
              <Button
                variant="frosted"
                className=" px-3 py-2.5 dark:text-primary-200 font-medium  rounded-xl"
                onClick={() => window.api.shell.openExternal(entity.url!)}
              >
                {iss.provider === "linear"
                  ? "View on Linear"
                  : iss.provider === "jira"
                    ? "View on Jira"
                    : iss.provider === "asana"
                      ? "View on Asana"
                      : iss.provider === "github"
                        ? "View on GitHub"
                        : "View on Provider"}
              </Button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
