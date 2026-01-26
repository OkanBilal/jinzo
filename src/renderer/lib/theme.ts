/**
 * Default theme configuration when no active mood is set.
 * These values are used as fallbacks throughout the application.
 */

export interface DefaultThemeConfig {
  /** Background color for light mode (with opacity) */
  lightBackground: string;
  /** Background color for dark mode (with opacity) */
  darkBackground: string;
  /** Dropdown background for light mode */
  lightDropdownBackground: string;
  /** Dropdown background for dark mode */
  darkDropdownBackground: string;
  /** Dropdown background opacity (0-1) for glassmorphism effect */
  dropdownOpacity: number;
}

/**
 * Default theme values when no mood is active.
 * Modify these values to change the default appearance.
 */
export const defaultTheme: DefaultThemeConfig = {
  // Main background colors (with alpha for transparency)
  lightBackground: "#0000001f",
  darkBackground: "#00000060",

  // Dropdown backgrounds (solid colors, opacity added dynamically)
  lightDropdownBackground: "rgb(255 255 255)",
  darkDropdownBackground: "rgb(17 24 39)",

  // Dropdown opacity for glassmorphism
  dropdownOpacity: 0.99,
};

/**
 * Get the default background color based on dark mode state
 */
export function getDefaultBackground(darkMode: boolean): string {
  return darkMode ? defaultTheme.darkBackground : defaultTheme.lightBackground;
}

/**
 * Get the default dropdown background with opacity
 */
export function getDefaultDropdownBackground(
  darkMode: boolean,
  opacity?: number
): string {
  const baseOpacity = opacity ?? defaultTheme.dropdownOpacity;
  return darkMode
    ? `rgb(17 24 39 / ${baseOpacity})`
    : `rgb(255 255 255 / ${baseOpacity})`;
}
