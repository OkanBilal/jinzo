import type { ReactNode } from "react";
import { useMainHeader } from "@/hooks/use-main-header";

interface MainContentProps {
  children: ReactNode;
  marginLeft: string;
  marginRight: string;
}

export function MainContent({
  children,
  marginLeft,
  marginRight,
}: MainContentProps) {
  const { header, firstTabActive } = useMainHeader();

  // When header exists and the first tab is active, the content's top-left corner
  // must be sharp so it connects seamlessly with the active tab above it.
  const contentRounding = header
    ? firstTabActive
      ? "rounded-2xl rounded-tl-none"
      : "rounded-2xl"
    : "rounded-2xl";

  return (
    <main
      className={`flex-1 overflow-hidden transition-all duration-300 ease-out m-1.5 flex flex-col`}
      style={{
        marginLeft,
        marginRight,
        transition: "margin 300ms ease-out",
      }}
    >
      {header && (
        <div className="shrink-0">{header}</div>
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
