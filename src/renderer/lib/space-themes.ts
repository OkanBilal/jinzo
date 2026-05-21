import { parseThemeConfig } from "./parse-theme-config";

export interface ThemeVariant {
  value: string;
  preview: string;
}

export interface ThemeColor {
  name: string;
  light: ThemeVariant;
  dark: ThemeVariant;
}

const solid = (light: string, dark: string): ThemeColor => ({
  name: "",
  light: { value: light, preview: light },
  dark: { value: `${dark}`, preview: dark },
});

export const solidColors: ThemeColor[] = [
  { ...solid("#ffffff40", "#00000070"), name: "Rose Quartz" },
  { ...solid("#EEEEEEe6", "#121212e6"), name: "Light Brown" },
  { ...solid("#C6E1D4e6", "#0e1a16e6"), name: "Light Green" },
  { ...solid("#C5DEEEe6", "#0d171de6"), name: "Light Blue" },
  { ...solid("#D6D4E8e6", "#181720e6"), name: "Light Purple" },
  { ...solid("#F1DFC4e6", "#1b140ae6"), name: "Light Yellow" },
  { ...solid("#EFD3D8e6", "#160e10e6"), name: "Light Pink" },
  { ...solid("#F2D2C7e6", "#231212e6"), name: "Light Red" },
];

/**
 * Maps a stored `space.themeConfig` blob back to the index of the
 * `solidColors` swatch that produced it. Used by space-edit UIs to highlight
 * the currently-selected colour. Gradients (which aren't in `solidColors`)
 * fall back to index 0.
 *
 * Note: this is the swatch-matching consumer; for the general parsed shape
 * use `parseThemeConfig` from `@/lib/parse-theme-config`.
 */
export function themeConfigToSwatchIndex(
  themeConfig: string | null,
): { colorIndex: number } {
  const parsed = parseThemeConfig(themeConfig);
  const darkBg = parsed.darkBackground || "";
  if (darkBg.includes("linear-gradient") || darkBg.includes("gradient")) {
    return { colorIndex: 0 };
  }
  for (let i = 0; i < solidColors.length; i++) {
    if (solidColors[i].dark.value === darkBg) {
      return { colorIndex: i };
    }
  }
  return { colorIndex: 0 };
}

export const getThemeVariant = (
  colorPair: ThemeColor,
  isDarkMode: boolean,
): ThemeVariant => (isDarkMode ? colorPair.dark : colorPair.light);

export type { ThemeVariant as SpaceThemeVariant, ThemeColor as SpaceThemeColor };
