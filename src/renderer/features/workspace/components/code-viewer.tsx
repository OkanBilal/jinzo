import { File } from "@pierre/diffs/react";
import type { FileContents } from "@pierre/diffs/react";

interface CodeViewerProps {
  content: string;
  filename?: string;
  className?: string;
}

export function CodeViewer({
  content,
  filename,
  className = "",
}: CodeViewerProps) {
  const isDarkMode = document.documentElement.classList.contains("dark");

  const file: FileContents = {
    name: filename ?? "file",
    contents: content,
  };

  return (
    <div className={`h-full overflow-auto ${className}`}>
      <File
        file={file}
        style={
          {
            "--diffs-font-size": "12px",
            "--diffs-font-family": "'Geist Mono', monospace",
          } as React.CSSProperties
        }
        options={{
          theme: isDarkMode ? "pierre-dark" : "pierre-light",
          themeType: isDarkMode ? "dark" : "light",
          overflow: "scroll",
          disableFileHeader: true,
        }}
      />
    </div>
  );
}
