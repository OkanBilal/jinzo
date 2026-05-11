import { useMemo } from "react";
import { useParsedUiConfig } from "./use-parsed-ui-config";

export type SidebarItemType = "workspace";

export interface SidebarConfig {
  width: string;
  title: string;
  itemType: SidebarItemType;
  defaultRoute: string;
}

export function useSidebarConfig(): SidebarConfig {
  const uiConfig = useParsedUiConfig();
  return useMemo(
    () => ({
      width: uiConfig.sidebar?.width || "var(--sidebar-width)",
      title: uiConfig.sidebar?.title || "Workspaces",
      itemType: (uiConfig.sidebar?.itemType || "workspace") as SidebarItemType,
      defaultRoute: uiConfig.sidebar?.defaultRoute || "/claude",
    }),
    [uiConfig],
  );
}
