import { memo, useState, useCallback } from "react";
import type { FileNode } from "../types";
import { FileIconComponent } from "./file-icon";
import { ArrowUp } from "@/components/ui/icons";

// ─────────────────────────────────────────────────────────────
// File Tree Node Component
// ─────────────────────────────────────────────────────────────

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
  onExpand?: (node: FileNode) => Promise<FileNode[] | undefined>;
  defaultExpanded?: boolean;
}

export const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  onExpand,
  defaultExpanded = false,
}: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [children, setChildren] = useState<FileNode[] | undefined>(node.children);
  const [isLoading, setIsLoading] = useState(false);
  // Track if we've attempted to load children
  const [childrenLoaded, setChildrenLoaded] = useState(
    node.children !== undefined && node.children.length > 0
  );

  const isDirectory = node.type === "directory";
  const isSelected = selectedPath === node.fullPath;

  // Show chevron if:
  // 1. node.hasChildren is explicitly true, OR
  // 2. node.hasChildren is undefined (not checked) and it's a directory, OR
  // 3. We have loaded children and there are some
  const showChevron = isDirectory && (
    node.hasChildren === true ||
    (node.hasChildren === undefined && !childrenLoaded) ||
    (children !== undefined && children.length > 0)
  );

  const handleClick = useCallback(async () => {
    onSelect(node);

    if (isDirectory) {
      // If expanding and children not loaded yet, lazy load them
      if (!isExpanded && onExpand && !childrenLoaded) {
        setIsLoading(true);
        try {
          const loadedChildren = await onExpand(node);
          setChildren(loadedChildren || []);
          setChildrenLoaded(true);
        } finally {
          setIsLoading(false);
        }
      }
      setIsExpanded((prev) => !prev);
    }
  }, [node, isDirectory, isExpanded, onExpand, childrenLoaded, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const paddingLeft = 0 + depth * 12;

  return (
    <div className="select-none">
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={isSelected}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`
          flex items-center h-7 cursor-pointer text-[14px]
          transition-colors duration-75 rounded-lg
          ${
            isSelected
              ? "bg-primary/80 dark:bg-primary/20 text-primary-950 dark:text-primary"
              : "text-primary-900 dark:text-primary-100 hover:bg-primary/50 dark:hover:bg-primary/10"
          }
        `}
        style={{ paddingLeft }}
      >
        {/* Expand/Collapse Chevron */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {isDirectory && showChevron && (
            <ArrowUp
              className={`
                w-3 h-3 text-primary-500 dark:text-primary-400
                transition-transform duration-150
                ${isExpanded ? "rotate-180" : "rotate-90"}
              `}
            />
          )}
        </span>

        {/* File/Folder Icon */}
        <FileIconComponent
          extension={node.extension}
          fileName={node.name}
          isDirectory={isDirectory}
          isExpanded={isExpanded}
          className="w-4 h-4 shrink-0 mr-1.5"
        />

        {/* File/Folder Name */}
        <span className="truncate">{node.name}</span>

        {/* Loading Indicator */}
        {isLoading && (
          <span className="ml-2 w-3 h-3 border border-primary-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Children */}
      {isDirectory && isExpanded && children && children.length > 0 && (
        <div role="group">
          {children.map((child) => (
            <FileTreeNode
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onExpand={onExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
});
