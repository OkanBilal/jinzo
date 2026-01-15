import { useMemo } from "react";
import { useActiveMood } from "./useActiveMood";

export interface ThemeConfig {
  backgroundColor?: string;
}

/**
 * Hook to get theme configuration from active mood's themeConfig
 * @returns {ThemeConfig} Theme configuration object
 */
export function useTheme(): ThemeConfig {
  const { activeMood } = useActiveMood();

  const themeConfig = useMemo(() => {
    const defaultConfig: ThemeConfig = {
      backgroundColor: "#00000060", // default dark background with full opacity
    };

    if (activeMood?.themeConfig) {
      try {
        const config = JSON.parse(activeMood.themeConfig);
        return {
          backgroundColor: config.backgroundColor || defaultConfig.backgroundColor,
        };
      } catch (error) {
        console.error("Failed to parse mood themeConfig:", error);
        return defaultConfig;
      }
    }

    return defaultConfig;
  }, [activeMood]);

  return themeConfig;
}
