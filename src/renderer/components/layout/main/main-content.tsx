import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

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
  const location = useLocation();
  const isWorkspaceRoute = location.pathname.startsWith("/workspace");

  return (
    <main
      className={`flex-1 overflow-hidden transition-all duration-300 ease-out ${isWorkspaceRoute ? "m-2" : "m-2"}`}
      style={{
        marginLeft,
        marginRight,
        transition: "margin 300ms ease-out",
      }}
    >
      <div
        className={`h-full bg-primary dark:bg-primary-950 overflow-auto ${isWorkspaceRoute ? "rounded-2xl" : "rounded-2xl"}`}
      >
        {children}
      </div>
    </main>
  );
}
