import { getContextIssueColor } from "@/lib/label-colors";
import type { FileNode } from "@/features/workspace/components/file-explorer";
import type { ContextIssue } from "@/lib/redux/slices/workspaceSlice";
import { Asana, Close, Gitlab, Jira } from "@/components/ui/icons";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";
import { Code } from "@/components/ui/icons/mood";

function IssueProviderIcon({ provider }: { provider: string }) {
  switch (provider) {
    case "github":
      return <Github className="w-3 h-3" />;
    case "linear":
      return <Linear className="w-3 h-3" />;
    case "jira":
      return <Jira className="w-3 h-3" />;
    case "asana":
      return <Asana className="w-3 h-3" />;
    case "gitlab":
      return <Gitlab className="w-3 h-3" />;
    default:
      return (
        <span className="text-[10px] font-medium uppercase">
          {provider.slice(0, 2)}
        </span>
      );
  }
}

interface ContextChipsProps {
  contextFiles: FileNode[];
  contextIssues: ContextIssue[];
  onRemoveContextFile?: (filePath: string) => void;
  onRemoveContextIssue?: (entityId: string) => void;
}

export function ContextChips({
  contextFiles,
  contextIssues,
  onRemoveContextFile,
  onRemoveContextIssue,
}: ContextChipsProps) {
  if (contextFiles.length === 0 && contextIssues.length === 0) return null;

  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out grid-rows-[1fr]`}
    >
      <div className="overflow-hidden">
        <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
          {contextFiles.map((file) => (
            <div
              key={file.fullPath}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary/8 text-xs text-primary-700 dark:text-primary-300"
            >
              <Code className="w-3 h-3" />
              <span className="truncate max-w-37.5">{file.name}</span>
              {onRemoveContextFile && (
                <button
                  onClick={() => onRemoveContextFile(file.fullPath)}
                  className="w-4 h-4 flex items-center justify-center rounded p-0.5 hover:bg-primary/20 dark:hover:bg-primary/10 transition-colors"
                  title="Remove from context"
                >
                  <Close className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {contextIssues.map((issue) => (
            <div
              key={issue.entityId}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${getContextIssueColor(issue.labels, issue.provider)}`}
            >
              <IssueProviderIcon provider={issue.provider} />
              <span className="truncate max-w-37.5">{issue.title}</span>
              {onRemoveContextIssue && (
                <button
                  onClick={() => onRemoveContextIssue(issue.entityId)}
                  className="w-4 h-4 flex items-center justify-center rounded p-0.5 hover:bg-purple-500/20 dark:hover:bg-purple-500/10 transition-colors"
                  title="Remove from context"
                >
                  <Close className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
