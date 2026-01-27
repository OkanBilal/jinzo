import { useState, useCallback, useEffect } from "react";
import {
  FileExplorer,
  type FileNode,
  type FileContentResponse,
  type ServiceResponse,
} from "@/features/file-explorer";

interface WorkspaceContentProps {
  rootPath?: string;
  onFileSelect?: (node: FileNode) => void;
}

export function WorkspaceContent({
  rootPath = "/Users/okanbalci/Desktop/jinzo",
  onFileSelect,
}: WorkspaceContentProps) {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [fileContent, setFileContent] = useState<FileContentResponse | null>(
    null,
  );
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Load file content when a file is selected
  useEffect(() => {
    if (!selectedFile || selectedFile.type !== "file" || !rootPath) {
      setFileContent(null);
      setContentError(null);
      return;
    }

    const filePath = selectedFile.fullPath;
    let cancelled = false;

    async function loadFileContent() {
      setIsLoadingContent(true);
      setContentError(null);
      setFileContent(null);

      try {
        const result: ServiceResponse<FileContentResponse> =
          await window.api.fileExplorer.readFileText({
            filePath,
            workspaceRoot: rootPath,
          });

        if (cancelled) return;

        if (result.success && result.data) {
          setFileContent(result.data);
        } else {
          setContentError(result.error || "Failed to load file");
        }
      } catch (err) {
        if (cancelled) return;
        setContentError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) {
          setIsLoadingContent(false);
        }
      }
    }

    loadFileContent();

    return () => {
      cancelled = true;
    };
  }, [selectedFile, rootPath]);

  const handleFileSelect = useCallback(
    (node: FileNode) => {
      setSelectedFile(node);
      onFileSelect?.(node);
    },
    [onFileSelect],
  );

  const handleCloseEditor = useCallback(() => {
    setSelectedFile(null);
    setFileContent(null);
    setContentError(null);
  }, []);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // If no rootPath provided, show empty state
  if (!rootPath) {
    return (
      <div className="flex-1 flex flex-col h-[calc(100%-1rem)] mt-2 dark:bg-primary-950/50 bg-primary mx-3 -pb-4 rounded-2xl overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-primary-500 dark:text-primary-400">
            <svg
              className="w-12 h-12 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span className="text-sm">No workspace selected</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100%-1rem)] mt-2 dark:bg-primary-950/50 bg-primary mx-3 -pb-4 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-primary-200 dark:border-primary-700/50">
        <h3 className="text-xs font-medium text-primary-600 dark:text-primary-300 uppercase tracking-wide">
          Explorer
        </h3>
      </div>

      {/* Split View: File Explorer + Editor */}
      <div className="flex-1 flex min-h-0">
        {/* File Explorer (left side) */}
        <div
          className={`flex flex-col min-h-0 ${
            selectedFile && selectedFile.type === "file"
              ? "w-1/3 border-r border-primary-200 dark:border-primary-700/50"
              : "w-full"
          }`}
        >
          <FileExplorer
            rootPath={rootPath}
            onFileSelect={handleFileSelect}
            initialDepth={2}
            className="flex-1 min-h-0"
          />
        </div>

        {/* Editor Pane (right side) */}
        {selectedFile && selectedFile.type === "file" && (
          <div className="w-2/3 flex flex-col min-h-0">
            {/* Editor Header */}
            <div className="shrink-0 px-3 py-2 border-b border-primary-200 dark:border-primary-700/50 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-primary-700 dark:text-primary-300 truncate">
                  {selectedFile.name}
                </p>
                {fileContent && (
                  <p className="text-[10px] text-primary-500 dark:text-primary-400">
                    {formatFileSize(fileContent.size)}
                    {fileContent.isBinary && " (binary)"}
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseEditor}
                className="shrink-0 p-1 rounded hover:bg-primary-200 dark:hover:bg-primary-700/50 text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 transition-colors"
                title="Close"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-auto min-h-0">
              {isLoadingContent && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-2 text-primary-500 dark:text-primary-400">
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Loading...</span>
                  </div>
                </div>
              )}

              {contentError && (
                <div className="flex items-center justify-center h-full p-4">
                  <div className="flex flex-col items-center gap-2 text-red-500 dark:text-red-400 text-center">
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
                    <span className="text-xs">{contentError}</span>
                  </div>
                </div>
              )}

              {fileContent && !isLoadingContent && !contentError && (
                <pre className="p-3 text-xs font-mono text-primary-800 dark:text-primary-200 whitespace-pre overflow-x-auto leading-relaxed">
                  {fileContent.content}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
