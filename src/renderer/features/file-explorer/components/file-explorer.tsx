import { memo, useState, useCallback, useEffect } from "react";
import type { FileNode, DirEntry, ServiceResponse } from "../types";
import { FileTreeNode } from "./file-tree-node";
import { Label } from "@/components/ui/text";
import { Error } from "@/components/ui/icons";

// ─────────────────────────────────────────────────────────────
// File Explorer Component
// ─────────────────────────────────────────────────────────────

interface FileExplorerProps {
  rootPath: string;
  onFileSelect?: (node: FileNode) => void;
  onDirectorySelect?: (node: FileNode) => void;
  onAddToContext?: (node: FileNode) => void;
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
  onAddToContext,
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

        const result: ServiceResponse<DirEntry[]> =
          await window.api.fileExplorer.listDir({
            dirPath: rootPath,
            includeHidden,
            excludePatterns,
          });

        if (cancelled) return;


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
      } catch (err: unknown) {
        if (cancelled) return;
        console.error("[FileExplorer] Exception loading tree:", err);
        setError(err instanceof globalThis.Error ? err.message : "Unknown error");
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

        const result: ServiceResponse<DirEntry[]> =
          await window.api.fileExplorer.listDir({
            dirPath: node.fullPath,
            includeHidden,
            excludePatterns,
          });


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
        <div className="flex flex-col items-center gap-2 ">
          <Label className="text-sm shine-text te ">Loading...</Label>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-2 text-red-500 dark:text-red-400 px-4 text-center">
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
        className="flex-1 overflow-auto py-1 space-y-1 noscrollbar"
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
            onAddToContext={onAddToContext}
            // Don't auto-expand - let user click to expand and lazy-load children
            defaultExpanded={false}
          />
        ))}
      </div>

      {/* {stats && (
        <div className="shrink-0 py-2 text-xs text-primary-500 dark:text-primary-400  border-primary-200 dark:border-primary-700/50">
          {stats.files} files, {stats.directories} folders
        </div>
      )} */}
    </div>
  );
});
