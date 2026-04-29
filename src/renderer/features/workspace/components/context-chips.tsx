import { useState, useEffect, useRef } from "react";
import type { FileNode } from "@/features/workspace/types/file-explorer";
import type {
  ContextIssue,
  ContextSignal,
  ContextSkill,
  ContextBrowserSelection,
} from "@/lib/redux/slices/workspaceSlice";
import { Close, Sparkles, Web } from "@/components/ui/icons";
import { Code } from "@/components/ui/icons/space";
import { ProviderIcon } from "./provider-icon";

interface ContextChipsProps {
  contextFiles: FileNode[];
  contextIssues: ContextIssue[];
  contextSignals?: ContextSignal[];
  contextSkills?: ContextSkill[];
  contextBrowserSelections?: ContextBrowserSelection[];
  onRemoveContextFile?: (filePath: string) => void;
  onRemoveContextIssue?: (entityId: string) => void;
  onRemoveContextSignal?: (entityId: string) => void;
  onRemoveContextSkill?: (name: string) => void;
  onRemoveContextBrowserSelection?: (id: string) => void;
}

function hostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function skillIconSrc(absPath: string): string {
  return `mains-localimg://img/?path=${encodeURIComponent(absPath)}`;
}

function ContextSkillChipIcon({ skill }: { skill: ContextSkill }) {
  const [failed, setFailed] = useState(false);
  const iconPath = skill.iconLarge || skill.iconSmall;
  if (iconPath && !failed) {
    return (
      <img
        src={skillIconSrc(iconPath)}
        alt=""
        className="w-3 h-3 rounded shrink-0 object-contain"
        style={skill.brandColor ? { backgroundColor: skill.brandColor } : undefined}
        onError={() => setFailed(true)}
      />
    );
  }
  return <Sparkles className="w-3 h-3 shrink-0" />;
}

function BrowserSelectionPreview({
  sel,
  onClose,
}: {
  sel: ContextBrowserSelection;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const surroundImg = sel.surroundingScreenshotCaptureName
    ? `mains-capture://cap/${sel.surroundingScreenshotCaptureName}`
    : undefined;
  const elementImg = sel.screenshotCaptureName
    ? `mains-capture://cap/${sel.screenshotCaptureName}`
    : undefined;
  const summary = sel.componentName || `${sel.tagName}${sel.selector ? ` · ${sel.selector.split(" > ").slice(-1)[0]}` : ""}`;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-10000 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative flex flex-col bg-primary-50 dark:bg-primary-950 glass-morphism rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-2 min-w-0">
            <Web className="w-3.5 h-3.5 shrink-0 text-primary-800 dark:text-primary-100" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary-900 dark:text-primary-100 truncate">
                {summary}
              </p>
              <p className="text-xs text-primary-500 dark:text-primary-400 truncate">
                {hostname(sel.url)}
                {sel.selector && <span className="opacity-60"> · {sel.selector}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 p-1 rounded-md hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors cursor-pointer"
          >
            <Close className="w-3.5 h-3.5 text-primary-500" />
          </button>
        </div>

        {/* Screenshot */}
        {surroundImg ? (
          <div className="relative bg-primary-100 dark:bg-primary-950">
            <img
              src={surroundImg}
              alt="Surrounding context"
              className="w-full max-h-72 object-contain"
            />
            {elementImg && (
              <div className="absolute bottom-2 right-2 rounded-md overflow-hidden border-2 border-blue-500 shadow-lg">
                <img
                  src={elementImg}
                  alt="Selected element"
                  className="max-w-32 max-h-20 object-contain bg-primary"
                />
              </div>
            )}
          </div>
        ) : elementImg ? (
          <div className="bg-primary-100 dark:bg-primary-900">
            <img
              src={elementImg}
              alt="Selected element"
              className="w-full max-h-72 object-contain"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 bg-primary-100 dark:bg-primary-900 text-primary-400 text-xs">
            No screenshot available
          </div>
        )}

        {/* Metadata */}
        {(sel.text || sel.sourceFile) && (
          <div className="px-4 py-2.5 border-t border-primary-200 dark:border-primary-800 space-y-1">
            {sel.sourceFile && (
              <p className="text-xs text-primary-500 dark:text-primary-400 font-mono truncate">
                {sel.sourceFile}
              </p>
            )}
            {sel.text && (
              <p className="text-xs text-primary-700 dark:text-primary-300 line-clamp-2">
                {sel.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ContextChips({
  contextFiles,
  contextIssues,
  contextSignals = [],
  contextSkills = [],
  contextBrowserSelections = [],
  onRemoveContextFile,
  onRemoveContextIssue,
  onRemoveContextSignal,
  onRemoveContextSkill,
  onRemoveContextBrowserSelection,
}: ContextChipsProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewSel = contextBrowserSelections.find((s) => s.id === previewId) ?? null;

  const hasContext =
    contextFiles.length > 0 ||
    contextIssues.length > 0 ||
    contextSignals.length > 0 ||
    contextSkills.length > 0 ||
    contextBrowserSelections.length > 0;

  return (
    <>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${hasContext ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
            {contextFiles.map((file) => (
              <div
                key={file.fullPath}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-200 dark:bg-primary/10 text-xs text-primary-700 dark:text-primary-300"
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
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary-200 dark:bg-primary-400 text-primary-600 dark:text-primary-100`}
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
            {contextSkills.map((skill) => {
              const label = skill.displayName || skill.name;
              const tooltip = skill.shortDescription || skill.description || label;
              return (
                <div
                  key={skill.name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary-500/15 dark:bg-primary-500/20 text-primary-500 dark:text-primary-300"
                  title={tooltip}
                >
                  <ContextSkillChipIcon skill={skill} />
                  <span className="truncate max-w-37.5">{label}</span>
                  {onRemoveContextSkill && (
                    <button
                      onClick={() => onRemoveContextSkill(skill.name)}
                      className="w-4 h-4 flex items-center justify-center rounded p-0.5 transition-colors hover:bg-primary-500/20"
                      title="Remove skill"
                    >
                      <Close className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {contextSignals.map((signal) => (
              <div
                key={signal.entityId}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary-200 dark:bg-primary-400 text-primary-600 dark:text-primary-100"
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
            {contextBrowserSelections.map((sel) => {
              const thumbName =
                sel.screenshotCaptureName || sel.surroundingScreenshotCaptureName;
              const thumb = thumbName ? `mains-capture://cap/${thumbName}` : undefined;
              const summary =
                sel.componentName ||
                sel.tagName +
                  (sel.selector ? ` · ${sel.selector.split(" > ").slice(-1)[0]}` : "");
              return (
                <div
                  key={sel.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreviewId(sel.id)}
                  onKeyDown={(e) => e.key === "Enter" && setPreviewId(sel.id)}
                  className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs bg-primary-200 dark:bg-primary/10 text-primary-700 dark:text-primary-300 cursor-pointer hover:bg-primary-300 dark:hover:bg-primary/20 transition-colors"
                  title={`Click to preview · ${sel.title || sel.url} — ${sel.selector}`}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="w-5 h-5 rounded-lg object-cover border border-primary-300/60 dark:border-primary-700/60"
                    />
                  ) : (
                    <Web className="w-3 h-3" />
                  )}
                  <span className="truncate max-w-44">
                    <span className="font-medium">{summary}</span>
                    <span className="opacity-60"> · {hostname(sel.url)}</span>
                  </span>
                  {onRemoveContextBrowserSelection && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveContextBrowserSelection(sel.id);
                      }}
                      className="w-4 h-4 flex items-center justify-center rounded p-0.5 hover:bg-primary/20 dark:hover:bg-primary/10 transition-colors"
                      title="Remove from context"
                    >
                      <Close className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {previewSel && (
        <BrowserSelectionPreview sel={previewSel} onClose={() => setPreviewId(null)} />
      )}
    </>
  );
}
