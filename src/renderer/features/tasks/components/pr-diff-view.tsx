import { useMemo, useState } from "react";
import { PatchDiff } from "@pierre/diffs/react";
import { useGetPrDiffQuery, type PrRefInput } from "@/lib/redux/api";
import { useIsDarkMode } from "@/hooks/use-is-dark-mode";
import { Button } from "@/components/ui";
import { Body } from "@/components/ui/text";
import { ArrowUp } from "@/components/ui/icons";

interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  patch: string;
}

/** Split a multi-file unified diff into per-file sections. */
export function splitDiffByFile(diffText: string): FileDiff[] {
  const files: FileDiff[] = [];
  const sections = diffText.split(/^(?=diff --git )/m).filter((s) => s.trim());

  for (const section of sections) {
    const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    if (!headerMatch) continue;
    const path = headerMatch[2];

    let additions = 0;
    let deletions = 0;
    for (const line of section.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }

    files.push({ path, additions, deletions, patch: section });
  }
  return files;
}

function FileSection({ file }: { file: FileDiff }) {
  const isDarkMode = useIsDarkMode();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl overflow-hidden glass-outline">
      <Button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-3 bg-primary/30 dark:bg-primary/5 cursor-pointer"
      >
        <span className="text-xs font-mono font-medium text-primary-900 dark:text-primary-100 truncate">
          {file.path}
        </span>
        <span className="ml-auto text-xxs tabular-nums whitespace-nowrap shrink-0">
          <span className="text-green-600 dark:text-green-400">+{file.additions}</span>{" "}
          <span className="text-red-500 dark:text-red-400">-{file.deletions}</span>
        </span>
        <ArrowUp
          className={`w-3 h-3 text-primary-600 dark:text-primary-400 transition-transform ${
            expanded ? "rotate-180" : "rotate-90"
          }`}
        />
      </Button>
      {/* grid-rows 1fr↔0fr — the codebase's smooth-collapse pattern
          (context-chips, activity-section). Content stays mounted so
          re-expanding animates instead of re-rendering the diff. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out  ${
          expanded ? "grid-rows-[1fr] pb-1" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <PatchDiff
            patch={file.patch}
            style={
              {
                "--diffs-font-size": "12px",
                "--diffs-font-family": "ui-monospace, monospace",
              } as React.CSSProperties
            }
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
  );
}

export function PrDiffView({ prRef }: { prRef: PrRefInput }) {
  const { data, isLoading, isError, refetch } = useGetPrDiffQuery(prRef);

  const files = useMemo(
    () => (data ? splitDiffByFile(data.diffText) : []),
    [data],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <span className="text-xs shine-text">Loading diff...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <Body className="text-xs text-primary-800 dark:text-primary-300">
          Unable to load the diff.
        </Body>
        <Button variant="subtle" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Body className="text-xs text-primary-800 dark:text-primary-300">
          No changes in this pull request.
        </Body>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data?.truncated && (
        <div className="px-3 py-3 rounded-xl bg-warning/10 text-xs text-warning ">
          This diff is large — only the first files are shown. Open the pull
          request on GitHub for the full diff.
        </div>
      )}
      {files.map((file) => (
        <FileSection key={file.path} file={file} />
      ))}
    </div>
  );
}
