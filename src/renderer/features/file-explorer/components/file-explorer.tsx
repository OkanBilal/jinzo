import { memo, useState, useCallback, useEffect } from "react";
import type { FileNode, DirEntry, ServiceResponse } from "../types";
import { FileTreeNode } from "./file-tree-node";

// ─────────────────────────────────────────────────────────────
// File Explorer Component
// ─────────────────────────────────────────────────────────────

interface FileExplorerProps {
  rootPath: string;
  onFileSelect?: (node: FileNode) => void;
  onDirectorySelect?: (node: FileNode) => void;
  includeHidden?: boolean;
  excludePatterns?: string[];
  initialDepth?: number;
  className?: string;
}

/** Convert DirEntry to FileNode */
function dirEntryToFileNode(entry: DirEntry): FileNode {
  return {
    name: entry.name,
    fullPath: entry.fullPath,
    type: entry.type,
    hasChildren: entry.hasChildren,
    size: entry.size,
    extension: entry.extension,
    // children undefined = not loaded yet
    children: undefined,
  };
}

export const FileExplorer = memo(function FileExplorer({
  rootPath,
  onFileSelect,
  onDirectorySelect,
  includeHidden = false,
  excludePatterns,
  initialDepth = 1, // Start with just first level for faster initial load
  className = "",
}: FileExplorerProps) {
  const [tree, setTree] = useState<FileNode | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ files: number; directories: number } | null>(null);

  // Load initial tree using listDir for the root
  useEffect(() => {
    let cancelled = false;

    async function loadTree() {
      setIsLoading(true);
      setError(null);

      try {
        console.log("[FileExplorer] Loading tree for:", rootPath);

        const result: ServiceResponse<DirEntry[]> =
          await window.api.fileExplorer.listDir({
            dirPath: rootPath,
            includeHidden,
            excludePatterns,
          });

        if (cancelled) return;

        console.log("[FileExplorer] listDir result:", result);

        if (result.success && result.data) {
          const rootName = rootPath.split("/").pop() || rootPath;
          const children = result.data.map(dirEntryToFileNode);

          // Count files and directories
          let fileCount = 0;
          let dirCount = 0;
          for (const entry of result.data) {
            if (entry.type === "file") fileCount++;
            else dirCount++;
          }

          setTree({
            name: rootName,
            fullPath: rootPath,
            type: "directory",
            hasChildren: children.length > 0,
            children,
          });
          setStats({
            files: fileCount,
            directories: dirCount,
          });
        } else {
          console.error("[FileExplorer] listDir failed:", result.error);
          setError(result.error || "Failed to load directory");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[FileExplorer] Exception loading tree:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadTree();

    return () => {
      cancelled = true;
    };
  }, [rootPath, includeHidden, excludePatterns]);

  // Handle node selection
  const handleSelect = useCallback(
    (node: FileNode) => {
      setSelectedPath(node.fullPath);

      if (node.type === "file" && onFileSelect) {
        onFileSelect(node);
      } else if (node.type === "directory" && onDirectorySelect) {
        onDirectorySelect(node);
      }
    },
    [onFileSelect, onDirectorySelect]
  );

  // Lazy load children for a directory using listDir
  const handleExpand = useCallback(
    async (node: FileNode): Promise<FileNode[] | undefined> => {
      try {
        console.log("[FileExplorer] Expanding:", node.fullPath);

        const result: ServiceResponse<DirEntry[]> =
          await window.api.fileExplorer.listDir({
            dirPath: node.fullPath,
            includeHidden,
            excludePatterns,
          });

        console.log("[FileExplorer] Expand result:", result);

        if (result.success && result.data) {
          return result.data.map(dirEntryToFileNode);
        } else {
          console.error("[FileExplorer] Failed to expand:", result.error);
        }
      } catch (err) {
        console.error("[FileExplorer] Failed to load directory:", err);
      }
      return undefined;
    },
    [includeHidden, excludePatterns]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-2 text-primary-500 dark:text-primary-400">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-2 text-red-500 dark:text-red-400 px-4 text-center">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // No content state
  if (!tree) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <span className="text-sm text-primary-500 dark:text-primary-400">
          No files found
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Tree Container */}
      <div
        role="tree"
        aria-label="File explorer"
        className="flex-1 overflow-auto py-1"
      >
        {/* Root node children (don't show root folder itself) */}
        {tree.children?.map((child) => (
          <FileTreeNode
            key={child.fullPath}
            node={child}
            depth={0}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            onExpand={handleExpand}
            // Don't auto-expand - let user click to expand and lazy-load children
            defaultExpanded={false}
          />
        ))}
      </div>

      {/* Stats Footer */}
      {stats && (
        <div className="shrink-0 px-3 py-2 text-xs text-primary-500 dark:text-primary-400 border-t border-primary-200 dark:border-primary-700/50">
          {stats.files} files, {stats.directories} folders
        </div>
      )}
    </div>
  );
});
