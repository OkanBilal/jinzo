import { memo, useState, useCallback, useEffect, useReducer } from "react";
import type { FileNode, DirEntry, ServiceResponse } from "../types";
import { FileTreeNode } from "./file-tree-node";
import { Label } from "@/components/ui";

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

function dirEntryToFileNode(entry: DirEntry): FileNode {
  return {
    name: entry.name,
    fullPath: entry.fullPath,
    type: entry.type,
    hasChildren: entry.hasChildren,
    size: entry.size,
    extension: entry.extension,
    children: undefined,
  };
}

type TreeState = {
  tree: FileNode | null;
  isLoading: boolean;
  error: string | null;
  stats: { files: number; directories: number } | null;
};

type TreeAction =
  | { type: "loading" }
  | { type: "loaded"; tree: FileNode; stats: { files: number; directories: number } }
  | { type: "error"; error: string };

function treeReducer(_: TreeState, action: TreeAction): TreeState {
  switch (action.type) {
    case "loading":
      return { tree: null, isLoading: true, error: null, stats: null };
    case "loaded":
      return { tree: action.tree, isLoading: false, error: null, stats: action.stats };
    case "error":
      return { tree: null, isLoading: false, error: action.error, stats: null };
  }
}

export const FileExplorer = memo(function FileExplorer({
  rootPath,
  onFileSelect,
  onDirectorySelect,
  onAddToContext,
  includeHidden = false,
  excludePatterns,
  className = "",
}: FileExplorerProps) {
  const [{ tree, isLoading, error }, dispatch] = useReducer(treeReducer, {
    tree: null,
    isLoading: true,
    error: null,
    stats: null,
  });
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTree() {
      dispatch({ type: "loading" });

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

          let fileCount = 0;
          let dirCount = 0;
          for (const entry of result.data) {
            if (entry.type === "file") fileCount++;
            else dirCount++;
          }

          dispatch({
            type: "loaded",
            tree: {
              name: rootName,
              fullPath: rootPath,
              type: "directory",
              hasChildren: children.length > 0,
              children,
            },
            stats: { files: fileCount, directories: dirCount },
          });
        } else {
          dispatch({ type: "error", error: result.error || "Failed to load directory" });
        }
      } catch (err: unknown) {
        if (cancelled) return;
        console.error("[FileExplorer] Exception loading tree:", err);
        dispatch({
          type: "error",
          error: err instanceof globalThis.Error ? err.message : "Unknown error",
        });
      }
    }

    loadTree();

    return () => {
      cancelled = true;
    };
  }, [rootPath, includeHidden, excludePatterns]);

  const handleSelect = useCallback(
    (node: FileNode) => {
      setSelectedPath(node.fullPath);

      if (node.type === "file" && onFileSelect) {
        onFileSelect(node);
      } else if (node.type === "directory" && onDirectorySelect) {
        onDirectorySelect(node);
      }
    },
    [onFileSelect, onDirectorySelect],
  );

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
    [includeHidden, excludePatterns],
  );

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-2 ">
          <Label className="text-xs shine-text ">Loading...</Label>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-2 text-red-500 dark:text-red-400 px-4 text-center">
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

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
      <div
        role="tree"
        aria-label="File explorer"
        className="flex-1 overflow-auto py-1 space-y-0.5 noscrollbar"
      >
        {tree.children?.map((child,index) => (
          <FileTreeNode
            key={child.fullPath}
            node={child}
            depth={0}
            index={index}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            onExpand={handleExpand}
            onAddToContext={onAddToContext}
            defaultExpanded={false}
          />
        ))}
      </div>
    </div>
  );
});
