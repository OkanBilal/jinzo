import { RefObject, useEffect, useMemo, useReducer } from "react";
import { Button } from "@/components/ui/button";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import { useClickOutside } from "@/hooks/use-click-outside";
import { FileIconComponent } from "@/features/workspace/components/file-explorer/components/file-icon";
import type { DirEntry } from "@/features/workspace/components/file-explorer/types";
import type { FileNode } from "@/features/workspace/components/file-explorer/types";
import type { InputVariant } from "../../../components/ui/input/send-button";

interface FetchState {
  entries: DirEntry[];
  loading: boolean;
  error: string | null;
}

type FetchAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; entries: DirEntry[] }
  | { type: "fetch_error"; error: string };

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { entries: action.entries, loading: false, error: null };
    case "fetch_error":
      return { entries: [], loading: false, error: action.error };
  }
}

interface FileMentionDropdownProps {
  isOpen: boolean;
  filterText: string;
  workspacePath?: string;
  onSelectFile: (node: FileNode) => void;
  onNavigate: (dirPath: string) => void;
  onClose: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  variant?: InputVariant;
}

const variantStyles = {
  default: {
    item: "hover:bg-primary-200/30 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-100 first:rounded-t-xl last:rounded-b-xl",
    description: "text-primary-500 dark:text-primary-400",
    sectionHeader: "text-primary-400 dark:text-primary-500",
  },
  copilot: {
    item: "hover:bg-copilot-dark/6 dark:hover:bg-copilot-light/6 text-copilot-dark dark:text-copilot-light first:rounded-t-xl last:rounded-b-xl",
    description: "text-copilot-dark/60 dark:text-copilot-light/60",
    sectionHeader: "text-copilot-dark/50 dark:text-copilot-light/50",
  },
  claude: {
    item: "hover:bg-claude-light/50 dark:hover:bg-claude-light/6 text-claude-dark dark:text-claude-light first:rounded-t-xl last:rounded-b-xlp to",
    description: "text-claude-dark/60 dark:text-claude-light/60",
    sectionHeader: "text-claude-dark/50 dark:text-claude-light/50",
  },
};

function parseFilterText(filterText: string): { dirPath: string; nameFilter: string } {
  const lastSlash = filterText.lastIndexOf("/");
  if (lastSlash === -1) {
    return { dirPath: "", nameFilter: filterText };
  }
  return {
    dirPath: filterText.slice(0, lastSlash + 1),
    nameFilter: filterText.slice(lastSlash + 1),
  };
}

export function FileMentionDropdown({
  isOpen,
  filterText,
  workspacePath,
  onSelectFile,
  onNavigate,
  onClose,
  dropdownRef,
  variant = "default",
}: FileMentionDropdownProps) {
  const styles = variantStyles[variant];
  const [fetchState, dispatchFetch] = useReducer(fetchReducer, {
    entries: [],
    loading: false,
    error: null,
  });

  useClickOutside(dropdownRef, () => {
    if (isOpen) onClose();
  });

  const { dirPath, nameFilter } = useMemo(() => parseFilterText(filterText), [filterText]);

  useEffect(() => {
    if (!isOpen || !workspacePath) return;

    let cancelled = false;
    dispatchFetch({ type: "fetch_start" });

    const fullDirPath = dirPath
      ? `${workspacePath}/${dirPath.replace(/\/$/, "")}`
      : workspacePath;

    window.api.fileExplorer
      .listDir({ dirPath: fullDirPath })
      .then((response: { success: boolean; data?: DirEntry[]; error?: string }) => {
        if (cancelled) return;
        if (response.success && response.data) {
          dispatchFetch({ type: "fetch_success", entries: response.data });
        } else {
          dispatchFetch({ type: "fetch_error", error: response.error || "Failed to list directory" });
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          dispatchFetch({ type: "fetch_error", error: err.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, workspacePath, dirPath]);

  const filteredEntries = useMemo(() => {
    if (!nameFilter) return fetchState.entries;
    const lower = nameFilter.toLowerCase();
    return fetchState.entries.filter((e) => e.name.toLowerCase().includes(lower));
  }, [fetchState.entries, nameFilter]);

  // Sort: directories first, then files, alphabetically within each group
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredEntries]);

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef}>
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-72"
        useFixedBackground={true}
      >
        <div className="max-h-80 max-w-100 overflow-auto noscrollbar">
          {dirPath && (
            <div className={`px-3 pt-2 pb-1 text-xs font-medium truncate ${styles.sectionHeader}`}>
              {dirPath}
            </div>
          )}
          {fetchState.loading ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              Loading...
            </div>
          ) : fetchState.error ? (
            <div className="px-4 py-3 text-sm text-primary-500  dark:text-primary-400">
              {fetchState.error}
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">
              No matching files
            </div>
          ) : (
            sortedEntries.map((entry) => (
              <Button
                key={entry.fullPath}
                type="button"
                onClick={() => {
                  if (entry.type === "directory") {
                    onNavigate(dirPath + entry.name + "/");
                  } else {
                    onSelectFile({
                      name: entry.name,
                      fullPath: entry.fullPath,
                      type: entry.type,
                      extension: entry.extension,
                      size: entry.size,
                    });
                  }
                }}
                className={`w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors ${styles.item}`}
              >
                <div className="flex items-center gap-2">
                  <FileIconComponent
                    isDirectory={entry.type === "directory"}
                    extension={entry.extension}
                    fileName={entry.name}
                    className="size-4 shrink-0"
                  />
                  <span className="truncate">{entry.name}</span>
                  {entry.type === "directory" && (
                    <span className={`ml-auto text-xs ${styles.description}`}>/</span>
                  )}
                </div>
              </Button>
            ))
          )}
        </div>
      </DropdownWrapper>
    </div>
  );
}
