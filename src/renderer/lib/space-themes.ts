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
  { ...solid("#EEEEEE", "#1c1c1cf5"), name: "Light Brown" },
  { ...solid("#C6E1D4", "#12221cf5"), name: "Light Green" },
  { ...solid("#C5DEEE", "#122028f5"), name: "Light Blue" },
  { ...solid("#D6D4E8", "#21202Df5"), name: "Light Purple" },
  { ...solid("#F1DFC4", "#332715f5"), name: "Light Yellow" },
  { ...solid("#EFD3D8", "#321F23f5"), name: "Light Pink" },
  { ...solid("#F3D0D2", "#341E20f5"), name: "Light Gray" },
  { ...solid("#F2D2C7", "#331F18f5"), name: "Light Red" },
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
