import { useMemo } from "react";
import { useActiveMood } from "./useActiveMood";

export type SidebarItemType = "chat" | "post";

export interface SidebarConfig {
  width: string;
  title: string;
  itemType: SidebarItemType;
  defaultRoute: string;
}

/**
 * Hook to get sidebar configuration from active mood's uiConfig
 * @returns {SidebarConfig} Sidebar configuration object
 */
export function useSidebarConfig(): SidebarConfig {
  const { activeMood } = useActiveMood();

  const sidebarConfig = useMemo(() => {
    // Default config
    const defaultConfig: SidebarConfig = {
      width: "20rem",
      title: "Chat",
      itemType: "chat",
      defaultRoute: "/",
    };

    // Parse uiConfig from active mood if available
    if (activeMood?.uiConfig) {
      try {
        const config = JSON.parse(activeMood.uiConfig);
        return {
          width: config.sidebar?.width || defaultConfig.width,
          title: config.sidebar?.title || defaultConfig.title,
          itemType: (config.sidebar?.itemType || defaultConfig.itemType) as SidebarItemType,
          defaultRoute: config.sidebar?.defaultRoute || defaultConfig.defaultRoute,
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
