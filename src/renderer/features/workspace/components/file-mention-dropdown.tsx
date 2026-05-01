import { RefObject, useCallback, useEffect, useMemo, useReducer } from "react";
import { Button, DropdownWrapper } from "@/components/ui";
import { useClickOutside } from "@/hooks/use-click-outside";
import { FileIconComponent } from "@/features/workspace/components/file-explorer/components/file-icon";
import type { DirEntry, FileNode } from "@/features/workspace/types/file-explorer";
import { useDropdownKeyboardNavigation } from "@/features/workspace/hooks/use-dropdown-keyboard-navigation";

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
}

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
}: FileMentionDropdownProps) {
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

  const selectEntryAt = useCallback(
    (index: number) => {
      const entry = sortedEntries[index];
      if (!entry) return;

      if (entry.type === "directory") {
        onNavigate(dirPath + entry.name + "/");
        return;
      }

      onSelectFile({
        name: entry.name,
        fullPath: entry.fullPath,
        type: entry.type,
        extension: entry.extension,
        size: entry.size,
      });
    },
    [dirPath, onNavigate, onSelectFile, sortedEntries],
  );

  const { activeIndex, setActiveIndex } = useDropdownKeyboardNavigation({
    isOpen,
    itemCount: sortedEntries.length,
    disabled: fetchState.loading || !!fetchState.error,
    resetKey: filterText,
    onSelectActive: selectEntryAt,
  });

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
            <div className="px-3 pt-2 pb-1 text-xs font-medium truncate text-primary-400 dark:text-primary-500">
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
            sortedEntries.map((entry, index) => (
              <Button
                key={entry.fullPath}
                type="button"
                data-dropdown-active={index === activeIndex ? "true" : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectEntryAt(index)}
                className={`w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-100 first:rounded-t-xl last:rounded-b-xl ${
                  index === activeIndex ? "bg-primary-200/30 dark:bg-primary-800" : ""
                }`}
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
                    <span className="ml-auto text-xs text-primary-500 dark:text-primary-400">/</span>
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
