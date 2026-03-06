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
            "--diffs-font-family": "'Space Mono', monospace",
          } as React.CSSProperties
        }
        options={{
          theme: isDarkMode ? "pierre-dark" : "pierre-light",
          themeType: isDarkMode ? "dark" : "light",
          overflow: "scroll",
          disableFileHeader: true,
          unsafeCSS: `:host, [data-diffs], [data-diffs-header], [data-error-wrapper], 
          [data-line], [data-column-number], [data-code] { --diffs-bg: ${isDarkMode ? "#0c0c0c" : "#ffffff"}; 
          background-color: ${isDarkMode ? "#0c0c0c" : "#ffffff"}; }`,
        }}
      />
    </div>
  );
}
