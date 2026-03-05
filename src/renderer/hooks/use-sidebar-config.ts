import { useMemo } from "react";
import { useActiveSpace } from "./use-active-space";

export type SidebarItemType = "chat" | "workspace";

export interface SidebarConfig {
  width: string;
  title: string;
  itemType: SidebarItemType;
  defaultRoute: string;
}

export function useSidebarConfig(): SidebarConfig {
  const { activeSpace } = useActiveSpace();

  const sidebarConfig = useMemo(() => {
    const defaultConfig: SidebarConfig = {
      width: "19rem",
      title: "Chat",
      itemType: "chat",
      defaultRoute: "/",
    };

    if (activeSpace?.uiConfig) {
      try {
        const config = JSON.parse(activeSpace.uiConfig);
        return {
          width: config.sidebar?.width || defaultConfig.width,
          title: config.sidebar?.title || defaultConfig.title,
          itemType: (config.sidebar?.itemType ||
            defaultConfig.itemType) as SidebarItemType,
          defaultRoute:
            config.sidebar?.defaultRoute || defaultConfig.defaultRoute,
        };
      } catch (error) {
        console.error("Failed to parse space uiConfig:", error);
        return defaultConfig;
      }
    }

    return defaultConfig;
  }, [activeSpace]);

  return sidebarConfig;
}
