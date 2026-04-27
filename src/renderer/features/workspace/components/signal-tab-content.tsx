import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { markdownComponents } from "@/components/markdown-components";
import type { SignalWithEntity } from "@/lib/redux/api";
import { Heading2, Button } from "@/components/ui";

interface SignalTabContentProps {
  signal: SignalWithEntity;
}

const levelColors: Record<string, string> = {
  fatal: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  critical: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  error: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  warning: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  info: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
};

const stateColors: Record<string, string> = {
  open: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  resolved: "bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-400",
  ignored: "bg-primary-100 dark:bg-primary-800 text-primary-500 dark:text-primary-500",
  regressed: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
};

export function SignalTabContent({ signal }: SignalTabContentProps) {
  const { signal: sig, entity } = signal;
  const title = entity.title || "Untitled signal";

  return (
    <div className="h-full overflow-y-auto noscrollbar">
      <div className="max-w-210 mx-auto pt-12 pb-24 px-6 space-y-6">
        <div className="space-y-3">
          {/* Title */}
          <Heading2 className="text-xl font-semibold text-primary-900 dark:text-primary-100">
            {title}
          </Heading2>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex capitalize items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                levelColors[sig.level] ?? levelColors.error
              }`}
            >
              {sig.level}
            </span>
            <span
              className={`inline-flex capitalize items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                stateColors[sig.state] ?? stateColors.open
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  sig.state === "open" ? "bg-green-500" : sig.state === "regressed" ? "bg-red-500" : "bg-primary-400"
                }`}
              />
              {sig.state}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-400 capitalize">
              {sig.category}
            </span>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-4 flex-wrap text-sm text-primary-500 dark:text-primary-400">
          <span>
            Source: <span className="font-medium text-primary-700 dark:text-primary-300 capitalize">{sig.source}</span>
          </span>
          {sig.eventCount > 1 && (
            <span>
              Events: <span className="font-medium text-primary-700 dark:text-primary-300 tabular-nums">{sig.eventCount}</span>
            </span>
          )}
          {sig.affectedUsers != null && sig.affectedUsers > 0 && (
            <span>
              Affected users: <span className="font-medium text-primary-700 dark:text-primary-300 tabular-nums">{sig.affectedUsers}</span>
            </span>
          )}
          {sig.assignee && (
            <span>
              Assigned to <span className="font-medium text-primary-700 dark:text-primary-300">{sig.assignee}</span>
            </span>
          )}
        </div>

        {/* File location */}
        {sig.file && (
          <div className="text-sm text-primary-500 dark:text-primary-400">
            <span className="font-mono text-xs bg-primary-100 dark:bg-primary-800 px-2 py-1 rounded">
              {sig.file}{sig.function ? `:${sig.function}` : ""}{sig.line ? `:${sig.line}` : ""}
            </span>
          </div>
        )}

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
            <p className="text-sm text-primary-400 dark:text-primary-500">
              No description provided.
            </p>
          )}
        </div>

        {/* Stack trace */}
        {sig.stackTrace && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-primary-700 dark:text-primary-300">Stack Trace</h3>
            <pre className="text-xs font-mono bg-primary-50 dark:bg-primary-800 p-4 rounded-xl overflow-x-auto text-primary-700 dark:text-primary-300 whitespace-pre-wrap">
              {sig.stackTrace}
            </pre>
          </div>
        )}

        {entity.url && (
          <div>
            <p className="mt-0.5">
              <Button
                variant="frosted"
                className="px-3 py-2.5 dark:text-primary-200 font-medium rounded-xl"
                onClick={() => window.api.shell.openExternal(entity.url!)}
              >
                View on {sig.source.charAt(0).toUpperCase() + sig.source.slice(1)}
              </Button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
