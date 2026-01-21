import { useMemo } from "react";
import { useActiveMood } from "./useActiveMood";
import { useDarkMode } from "./useDarkMode";
import { getDefaultBackground } from "@/lib/theme";

export interface ThemeConfig {
  backgroundColor?: string;
}

export interface StoredThemeConfig {
  backgroundColor?: string; // Legacy single color
  lightBackground?: string; // Light mode background
  darkBackground?: string; // Dark mode background
  lightUserMessageBackground?: string; // Light mode user message background
  darkUserMessageBackground?: string; // Dark mode user message background
}

/**
 * Hook to get theme configuration from active mood's themeConfig
 * Automatically switches between light/dark variants based on app theme
 * @returns {ThemeConfig} Theme configuration object
 */
export function useTheme(): ThemeConfig {
  const { activeMood } = useActiveMood();
  const { darkMode } = useDarkMode();

  const themeConfig = useMemo(() => {
    const defaultConfig: ThemeConfig = {
      backgroundColor: getDefaultBackground(darkMode),
    };

    if (activeMood?.themeConfig) {
      try {
        const config: StoredThemeConfig = JSON.parse(activeMood.themeConfig);

        // Determine background color
        let backgroundColor = defaultConfig.backgroundColor;
        if (config.lightBackground && config.darkBackground) {
          backgroundColor = darkMode
            ? config.darkBackground
            : config.lightBackground;
        } else if (config.backgroundColor) {
          backgroundColor = config.backgroundColor;
        }

        return {
          backgroundColor,
        };
      } catch (error) {
        console.error("Failed to parse mood themeConfig:", error);
        return defaultConfig;
      }
    }

    return defaultConfig;
  }, [activeMood, darkMode]);

  return themeConfig;
}
