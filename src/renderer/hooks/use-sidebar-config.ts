import { useMemo } from "react";
import { useActiveMood } from "./use-active-mood";

export type SidebarItemType = "chat" | "post" | "workspace" | "claude";

export interface SidebarConfig {
  width: string;
  title: string;
  itemType: SidebarItemType;
  defaultRoute: string;
}

export function useSidebarConfig(): SidebarConfig {
  const { activeMood } = useActiveMood();

  const sidebarConfig = useMemo(() => {
    const defaultConfig: SidebarConfig = {
      width: "19rem",
      title: "Chat",
      itemType: "chat",
      defaultRoute: "/",
    };

    if (activeMood?.uiConfig) {
      try {
        const config = JSON.parse(activeMood.uiConfig);
        return {
          width: config.sidebar?.width || defaultConfig.width,
          title: config.sidebar?.title || defaultConfig.title,
          itemType: (config.sidebar?.itemType ||
            defaultConfig.itemType) as SidebarItemType,
          defaultRoute:
            config.sidebar?.defaultRoute || defaultConfig.defaultRoute,
        };
      } catch (error) {
        console.error("Failed to parse mood uiConfig:", error);
        return defaultConfig;
      }
    }

    return defaultConfig;
  }, [activeMood]);

  return sidebarConfig;
}
