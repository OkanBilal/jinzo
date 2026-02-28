import { useMemo } from "react";
import { useActiveSpace } from "./use-active-space";
import { useDarkMode } from "./use-dark-mode";
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
  // Nested format from predefined spaces
  light?: { value: string; preview?: string };
  dark?: { value: string; preview?: string };
}

/**
 * Hook to get theme configuration from active space's themeConfig
 * Automatically switches between light/dark variants based on app theme
 * @returns {ThemeConfig} Theme configuration object
 */
export function useTheme(): ThemeConfig {
  const { activeSpace } = useActiveSpace();
  const { darkMode } = useDarkMode();

  const themeConfig = useMemo(() => {
    const defaultConfig: ThemeConfig = {
      backgroundColor: getDefaultBackground(darkMode),
    };

    if (activeSpace?.themeConfig) {
      try {
        const config: StoredThemeConfig = JSON.parse(activeSpace.themeConfig);

        // Determine background color
        let backgroundColor = defaultConfig.backgroundColor;
        if (config.lightBackground && config.darkBackground) {
          backgroundColor = darkMode
            ? config.darkBackground
            : config.lightBackground;
        } else if (config.light?.value && config.dark?.value) {
          // Handle nested format: { light: { value }, dark: { value } }
          backgroundColor = darkMode
            ? config.dark.value
            : config.light.value;
        } else if (config.backgroundColor) {
          backgroundColor = config.backgroundColor;
        }

        return {
          backgroundColor,
        };
      } catch (error) {
        console.error("Failed to parse space themeConfig:", error);
        return defaultConfig;
      }
    }

    return defaultConfig;
  }, [activeSpace, darkMode]);

  return themeConfig;
}
