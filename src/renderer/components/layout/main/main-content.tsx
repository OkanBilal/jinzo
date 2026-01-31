import type { ReactNode } from "react";
import { useRouteType } from "@/hooks/use-route-type";

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
  const routeType = useRouteType();
  const isWorkspaceRoute = routeType === "workspace";

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
