import { useMemo } from "react";
import { useActiveMood } from "./useActiveMood";
import { useDarkMode } from "./useDarkMode";

export interface ThemeConfig {
  backgroundColor?: string;
  userMessageBackgroundColor?: string;
}

export interface StoredThemeConfig {
  backgroundColor?: string; // Legacy single color
  lightBackground?: string; // Light mode background
  darkBackground?: string;  // Dark mode background
  userMessageBackgroundColor?: string; // Legacy single color
  lightUserMessageBackground?: string; // Light mode user message background
  darkUserMessageBackground?: string;  // Dark mode user message background
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
      backgroundColor: darkMode ? "#00000060" : "#ffffff60",
      userMessageBackgroundColor: undefined, // Will use Tailwind classes as fallback
    };

    if (activeMood?.themeConfig) {
      try {
        const config: StoredThemeConfig = JSON.parse(activeMood.themeConfig);
        
        // Determine background color
        let backgroundColor = defaultConfig.backgroundColor;
        if (config.lightBackground && config.darkBackground) {
          backgroundColor = darkMode ? config.darkBackground : config.lightBackground;
        } else if (config.backgroundColor) {
          backgroundColor = config.backgroundColor;
        }
        
        // Determine user message background color
        let userMessageBackgroundColor: string | undefined = undefined;
        if (config.lightUserMessageBackground && config.darkUserMessageBackground) {
          userMessageBackgroundColor = darkMode ? config.darkUserMessageBackground : config.lightUserMessageBackground;
        } else if (config.userMessageBackgroundColor) {
          userMessageBackgroundColor = config.userMessageBackgroundColor;
        }
        
        return {
          backgroundColor,
          userMessageBackgroundColor,
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
