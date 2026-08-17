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
  { ...solid("#ffffffb3", "#00000070"), name: "Rose Quartz" },
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

/**
 * Light pastel hex the theme's hue derives from. Always the light-mode value —
 * dark swatch values are near-black and carry no usable hue. Returns `null`
 * for gradients/unset themes.
 */
function themeHueSource(themeConfig: string | null): string | null {
  const cfg = parseThemeConfig(themeConfig);
  const base =
    cfg.lightBackground ?? cfg.light?.value ?? cfg.backgroundColor ?? "";
  if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(base)) return null;
  return base.slice(0, 7);
}

/**
 * Ambient glow color for the active space, used to backlight the empty-state
 * composer. CSS relative color syntax re-tints the pastel per mode, and alpha
 * scales with the pastel's own saturation so neutral themes (Rose Quartz,
 * Light Brown) fade out instead of casting a gray shadow.
 */
export function spaceGlowColor(
  themeConfig: string | null,
  isDarkMode: boolean,
): string | null {
  const hex = themeHueSource(themeConfig);
  if (!hex) return null;
  return isDarkMode
    ? `hsl(from ${hex} h calc(s * 1) 10% / calc(s * 0.5))`
    : `hsl(from ${hex} h calc(s * 1) 90% / calc(s * 0.5))`;
}

/**
 * User-message bubble background for the active space. An explicit
 * `*UserMessageBackground` in the theme blob wins; otherwise the bubble is
 * tinted from the same pastel as `spaceGlowColor`. Returns `null` when the
 * theme carries no usable color so callers keep their static fallback classes.
 */
export function spaceUserMessageBackground(
  themeConfig: string | null,
  isDarkMode: boolean,
): string | null {
  const cfg = parseThemeConfig(themeConfig);
  const explicit = isDarkMode
    ? cfg.darkUserMessageBackground
    : cfg.lightUserMessageBackground;
  if (explicit) return explicit;
  const hex = themeHueSource(themeConfig);
  if (!hex) return null;
  return isDarkMode
    ? `hsl(from ${hex} h calc(s * 1.2) 65% / 0.12)`
    : `hsl(from ${hex} h calc(s * 1.2) 85% / 0.6)`;
}


export type { ThemeVariant as SpaceThemeVariant, ThemeColor as SpaceThemeColor };
