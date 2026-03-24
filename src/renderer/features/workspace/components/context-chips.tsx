import type { FileNode } from "@/features/workspace/components/file-explorer";
import type { ContextIssue, ContextSignal } from "@/lib/redux/slices/workspaceSlice";
import { Close } from "@/components/ui/icons";
import { Code } from "@/components/ui/icons/space";
import { ProviderIcon } from "./provider-icon";

interface ContextChipsProps {
  contextFiles: FileNode[];
  contextIssues: ContextIssue[];
  contextSignals?: ContextSignal[];
  onRemoveContextFile?: (filePath: string) => void;
  onRemoveContextIssue?: (entityId: string) => void;
  onRemoveContextSignal?: (entityId: string) => void;
}

export function ContextChips({
  contextFiles,
  contextIssues,
  contextSignals = [],
  onRemoveContextFile,
  onRemoveContextIssue,
  onRemoveContextSignal,
}: ContextChipsProps) {
  const hasContext = contextFiles.length > 0 || contextIssues.length > 0 || contextSignals.length > 0;

  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out ${hasContext ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
    >
      <div className="overflow-hidden min-h-0">
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary-200 dark:bg-primary-500/40 text-primary-600 dark:text-primary-100`}
            >
              <ProviderIcon provider={issue.provider} className="w-3 h-3" fallback="text" />
              <span className="truncate max-w-37.5">{issue.title}</span>
              {onRemoveContextIssue && (
                <button
                  onClick={() => onRemoveContextIssue(issue.entityId)}
                  className="w-4 h-4 flex items-center justify-center rounded p-0.5  transition-colors"
                  title="Remove from context"
                >
                  <Close className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {contextSignals.map((signal) => (
            <div
              key={signal.entityId}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary-200 dark:bg-primary-500/40 text-primary-600 dark:text-primary-100"
            >
              <ProviderIcon provider={signal.source} className="w-3 h-3" fallback="text" />
              <span className="truncate max-w-37.5">{signal.title}</span>
              {onRemoveContextSignal && (
                <button
                  onClick={() => onRemoveContextSignal(signal.entityId)}
                  className="w-4 h-4 flex items-center justify-center rounded p-0.5 transition-colors"
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
