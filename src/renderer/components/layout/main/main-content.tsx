import { useEffect, useState, type ReactNode } from "react";
import { useMainHeader } from "@/hooks/use-main-header";

interface MainContentProps {
  children: ReactNode;
  marginLeft: string;
  marginRight: string;
  hasRightPanel?: boolean;
  sidebarCollapsed?: boolean;
  browserOpen?: boolean;
}

export function MainContent({
  children,
  marginLeft,
  marginRight,
  hasRightPanel,
  sidebarCollapsed,
  browserOpen,
}: MainContentProps) {
  const { header, firstTabActive } = useMainHeader();
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    return window.api.app.onFullscreenChange(setIsFullscreen);
  }, []);

  const headerPaddingLeft =
    sidebarCollapsed ? (isFullscreen ? "1.5rem" : "7rem") : undefined;

  // When header exists and the first tab is active, the content's top-left corner
  // must be sharp so it connects seamlessly with the active tab above it.
  // Exception: when sidebar is collapsed, always round top-left since there's no sidebar edge.
  const rightRounding = browserOpen ? "rounded-tr-none rounded-br-none" : "";
  const contentRounding = header
    ? firstTabActive && !sidebarCollapsed
      ? `rounded-xl rounded-tl-none ${rightRounding}`
      : `rounded-xl ${rightRounding}`
    : `rounded-xl ${rightRounding}`;

  return (
    <main
      className={`flex-1 overflow-hidden transition-all duration-300 ease-out mx-1.25 my-1.25 flex flex-col`}
      style={{
        marginLeft,
        marginRight,
        transition: "margin 300ms ease-out",
      }}
    >
      {header && (
        <div
          className={`shrink-0 transition-all duration-300 ease-out ${hasRightPanel ? "max-w-[calc(100%-170px)]" : browserOpen ? "max-w-[calc(100%-180px)]" : ""}`}
          style={{ paddingLeft: headerPaddingLeft }}
        >
          {header}
        </div>
      )}
      <div
        className={`flex-1 min-h-0 bg-primary dark:bg-primary-950 overflow-hidden ${contentRounding}`}
      >
        <div className="h-full overflow-auto">
          {children}
        </div>
      </div>
    </main>
  );
}
