import { lazy, Suspense } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/lib/redux";

const CodeMirrorEditor = lazy(() =>
  import("./codemirror-editor").then((m) => ({ default: m.CodeMirrorEditor })),
);
const DiffViewer = lazy(() =>
  import("./diff-viewer").then((m) => ({ default: m.DiffViewer })),
);

interface EditorContentProps {
  className?: string;
}

export function EditorContent({ className = "" }: EditorContentProps) {
  const selectedFile = useSelector((state: RootState) => state.workspace.selectedFile);
  const selectedFileContent = useSelector((state: RootState) => state.workspace.selectedFileContent);
  const isLoadingFileContent = useSelector((state: RootState) => state.workspace.isLoadingFileContent);
  const fileContentError = useSelector((state: RootState) => state.workspace.fileContentError);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Empty state - no file selected
  if (!selectedFile) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>

      </div>
    );
  }

  // Loading state
  if (isLoadingFileContent) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-2 text-primary-500 dark:text-primary-400">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Loading file...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (fileContentError) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-2 text-red-500 dark:text-red-400 text-center px-4">
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
          <span className="text-xs">{fileContentError}</span>
        </div>
      </div>
    );
  }

  // No content loaded yet
  if (!selectedFileContent) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-2 text-primary-500 dark:text-primary-400">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Loading...</span>
        </div>
      </div>
    );
  }

  // Binary file
  if (selectedFileContent.isBinary) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-2 text-primary-500 dark:text-primary-400 text-center px-4">
          <svg
            className="w-8 h-8 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-sm font-medium">{selectedFile.name}</span>
          <span className="text-xs">Binary file ({formatFileSize(selectedFileContent.size)})</span>
          <span className="text-xs opacity-60">Preview not available for binary files</span>
        </div>
      </div>
    );
  }

  if (selectedFile.extension === "diff") {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 min-h-0 overflow-hidden">
          <Suspense fallback={null}>
            <DiffViewer
              diffText={selectedFileContent.content}
              filename={selectedFile.name}
              className="h-full"
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // Render CodeMirror editor
  return (
    <div className={`flex flex-col h-full ${className}`}>

      {/* Editor content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={null}>
          <CodeMirrorEditor
            content={selectedFileContent.content}
            filename={selectedFile.name}
            className="h-full"
          />
        </Suspense>
      </div>
    </div>
  );
}
