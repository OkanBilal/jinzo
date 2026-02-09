import { memo, useState, useCallback } from "react";
import type { FileNode } from "../types";
import { FileIconComponent } from "./file-icon";
import { ArrowUp, Plus } from "@/components/ui/icons";

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
  onExpand?: (node: FileNode) => Promise<FileNode[] | undefined>;
  onAddToContext?: (node: FileNode) => void;
  defaultExpanded?: boolean;
}

export const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  onExpand,
  onAddToContext,
  defaultExpanded = false,
}: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [children, setChildren] = useState<FileNode[] | undefined>(
    node.children,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [childrenLoaded, setChildrenLoaded] = useState(
    node.children !== undefined && node.children.length > 0,
  );

  const isDirectory = node.type === "directory";
  const isSelected = selectedPath === node.fullPath;

  const showChevron =
    isDirectory &&
    (node.hasChildren === true ||
      (node.hasChildren === undefined && !childrenLoaded) ||
      (children !== undefined && children.length > 0));

  const handleClick = useCallback(async () => {
    onSelect(node);

    if (isDirectory) {
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
    [handleClick],
  );

  const handleAddToContext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onAddToContext && node.type === "file") {
        onAddToContext(node);
      }
    },
    [node, onAddToContext],
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
          group flex items-center h-7 cursor-pointer text-[14px]
          transition-colors duration-75 rounded-lg
          ${
            isSelected
              ? "bg-primary/80 dark:bg-primary/5 text-primary-950 dark:text-primary"
              : "text-primary-900 dark:text-primary-100 hover:bg-primary/20 dark:hover:bg-primary/5"
          }
        `}
        style={{ paddingLeft }}
      >
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

        <FileIconComponent
          extension={node.extension}
          fileName={node.name}
          isDirectory={isDirectory}
          isExpanded={isExpanded}
          className="w-4 h-4 shrink-0 mr-1.5"
        />

        <span className="truncate flex-1">{node.name}</span>

        {!isDirectory && onAddToContext && (
          <button
            onClick={handleAddToContext}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-primary/20 dark:hover:bg-primary/10 transition-opacity mr-1"
            title="Add to context"
          >
            <Plus className="w-3.5 h-3.5 text-primary-500 dark:text-primary-400" />
          </button>
        )}

        {isLoading && (
          <span className="ml-2 w-3 h-3 border border-primary-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

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
              onAddToContext={onAddToContext}
            />
          ))}
        </div>
      )}
    </div>
  );
});
