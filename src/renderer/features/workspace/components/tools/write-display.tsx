import { useMemo, useState } from "react";
import { ArrowUp, Edit } from "@/components/ui/icons";
import { PatchDiff } from "@pierre/diffs/react";

export interface WriteParams {
  file_path?: string;
  content?: string;
}


export function WriteDisplay({ params }: { params: WriteParams }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDarkMode = document.documentElement.classList.contains("dark");

  const filePath = params.file_path ?? "";
  const content = params.content ?? "";
  const fileName = filePath.split("/").pop() || filePath;
  const lineCount = content ? content.split("\n").length : 0;
  const hasDiff = !!content;

  const unifiedDiff = useMemo(() => {
    if (!content) return "";
    const lines = content.split("\n");
    return [
      `--- /dev/null`,
      `+++ b/${fileName}`,
      `@@ -0,0 +1,${lines.length} @@`,
      ...lines.map((l) => `+${l}`),
    ].join("\n");
  }, [content, fileName]);

  return (
    <div className="">
      <button
        onClick={() => hasDiff && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-primary-400 dark:text-primary-500 text-s font-sans ${hasDiff ? "cursor-pointer" : "cursor-default"}`}
      >
        <Edit className="size-3.5 text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />
        <span className="text-primary-400 dark:text-primary-500 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
          Write
        </span>
        <span className="text-primary-400 dark:text-primary-500 font-medium truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {fileName}
        </span>
        {lineCount > 0 && (
          <span className="text-green-600 dark:text-green-400 text-xs shrink-0">
            +{lineCount}
          </span>
        )}
        {hasDiff && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-400 dark:text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {unifiedDiff && (
        <div className={`grid transition-all duration-200 rounded-md border border-primary-200/50 dark:border-primary-700/30 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className=" max-h-80 overflow-y-auto noscrollbar p-0.5">
              <PatchDiff
                patch={unifiedDiff}
                style={{ "--diffs-font-size": "12px", "--diffs-font-family": "'Geist Mono', monospace" } as React.CSSProperties}
                options={{
                  theme: isDarkMode ? "pierre-dark" : "pierre-light",
                  themeType: isDarkMode ? "dark" : "light",
                  diffStyle: "unified",
                  overflow: "wrap",
                  disableFileHeader: true,
                  unsafeCSS: `:host, [data-diffs], [data-diffs-header], [data-error-wrapper], [data-line], [data-column-number], [data-code] { --diffs-bg: var(--color-${isDarkMode ? "primary-950" : "primary"}); background-color: var(--color-${isDarkMode ? "primary-950" : "primary"}); }`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
