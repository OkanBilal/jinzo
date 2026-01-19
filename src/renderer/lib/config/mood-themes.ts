/**
 * Mood Theme Definitions
 *
 * Each theme has light and dark variants:
 * - Light themes use soft pastels and light gradients
 * - Dark themes use deep, rich colors and dark gradients
 */

export interface ThemeVariant {
  value: string;
  preview: string;
}

export interface ThemeColor {
  name: string;
  light: ThemeVariant;
  dark: ThemeVariant;
}

// 8 Solid Colors - light variants are pastel, dark variants are deep/muted
export const solidColors: ThemeColor[] = [
  {
    name: "Plum",
    light: { value: "#E8D5F299", preview: "#E8D5F2" },
    dark: { value: "#2D1F3395", preview: "#2D1F33" },
  },
  {
    name: "Crimson",
    light: { value: "#F5D0CD99", preview: "#F5D0CD" },
    dark: { value: "#3D1A1895", preview: "#3D1A18" },
  },
  {
    name: "Terracotta",
    light: { value: "#F5DCC899", preview: "#F5DCC8" },
    dark: { value: "#3D291A95", preview: "#3D291A" },
  },
  {
    name: "Sunset",
    light: { value: "#FFF3C499", preview: "#FFF3C4" },
    dark: { value: "#3D351A95", preview: "#3D351A" },
  },
  {
    name: "Sage",
    light: { value: "#F0F4E499", preview: "#F0F4E4" },
    dark: { value: "#2A2D2095", preview: "#2A2D20" },
  },
  {
    name: "Mint",
    light: { value: "#D4EDE399", preview: "#D4EDE3" },
    dark: { value: "#1A2D2695", preview: "#1A2D26" },
  },
  {
    name: "Forest",
    light: { value: "#C8E6D999", preview: "#C8E6D9" },
    dark: { value: "#142D2295", preview: "#142D22" },
  },
  {
    name: "Ocean",
    light: { value: "#C5D9EB99", preview: "#C5D9EB" },
    dark: { value: "#1A233395", preview: "#1A2333" },
  },
];

// 8 Gradient Colors - light variants are soft pastels, dark variants are deep/rich
export const gradientColors: ThemeColor[] = [
  {
    name: "Aurora",
    light: {
      value: "linear-gradient(135deg, #FFD4E8 0%, #FFE4C8 50%, #FFF4D4 100%)",
      preview:
        "linear-gradient(135deg, #FFD4E8 0%, #FFE4C8 50%, #FFF4D4 100%)",
    },
    dark: {
      value:
        "linear-gradient(135deg, #2D1A26 0%, #2D2318 50%, #2D2A1A 100%)",
      preview:
        "linear-gradient(135deg, #3D2A36 0%, #3D3328 50%, #3D3A2A 100%)",
    },
  },
  {
    name: "Ocean Wave",
    light: {
      value: "linear-gradient(180deg, #BFDBFE 0%, #93C5FD 100%)",
      preview: "linear-gradient(180deg, #BFDBFE 0%, #93C5FD 100%)",
    },
    dark: {
      value: "linear-gradient(180deg, #1A2744 0%, #0F172A 100%)",
      preview: "linear-gradient(180deg, #1E3A5F 0%, #0F172A 100%)",
    },
  },
  {
    name: "Dawn",
    light: {
      value: "linear-gradient(180deg, #FEF9E7 0%, #DBEAFE 100%)",
      preview: "linear-gradient(180deg, #FEF9E7 0%, #DBEAFE 100%)",
    },
    dark: {
      value: "linear-gradient(180deg, #2D2A1A 0%, #1A2333 100%)",
      preview: "linear-gradient(180deg, #3D3A2A 0%, #1E2A40 100%)",
    },
  },
  {
    name: "Sunset Glow",
    light: {
      value: "linear-gradient(180deg, #FFEDD5 0%, #FED7AA 100%)",
      preview: "linear-gradient(180deg, #FFEDD5 0%, #FED7AA 100%)",
    },
    dark: {
      value: "linear-gradient(180deg, #3D2A1A 0%, #2D1F14 100%)",
      preview: "linear-gradient(180deg, #4D3A2A 0%, #3D2F24 100%)",
    },
  },
  {
    name: "Golden Hour",
    light: {
      value: "linear-gradient(180deg, #FEF9C3 0%, #FDE68A 100%)",
      preview: "linear-gradient(180deg, #FEF9C3 0%, #FDE68A 100%)",
    },
    dark: {
      value: "linear-gradient(180deg, #2D2A14 0%, #3D350A 100%)",
      preview: "linear-gradient(180deg, #3D3A24 0%, #4D451A 100%)",
    },
  },
  {
    name: "Cotton Candy",
    light: {
      value: "linear-gradient(180deg, #FDF2F8 0%, #F5D0FE 100%)",
      preview: "linear-gradient(180deg, #FDF2F8 0%, #F5D0FE 100%)",
    },
    dark: {
      value: "linear-gradient(180deg, #2D1A26 0%, #2A1A33 100%)",
      preview: "linear-gradient(180deg, #3D2A36 0%, #3A2A43 100%)",
    },
  },
  {
    name: "Twilight",
    light: {
      value: "linear-gradient(180deg, #E0E7FF 0%, #C7D2FE 100%)",
      preview: "linear-gradient(180deg, #E0E7FF 0%, #C7D2FE 100%)",
    },
    dark: {
      value: "linear-gradient(180deg, #1A1A33 0%, #14142D 100%)",
      preview: "linear-gradient(180deg, #2A2A43 0%, #24243D 100%)",
    },
  },
  {
    name: "Deep Space",
    light: {
      value: "linear-gradient(180deg, #C7D2FE 0%, #A5B4FC 100%)",
      preview: "linear-gradient(180deg, #C7D2FE 0%, #A5B4FC 100%)",
    },
    dark: {
      value: "linear-gradient(180deg, #14142D 0%, #0A0A1A 100%)",
      preview: "linear-gradient(180deg, #1E1E3D 0%, #14142A 100%)",
    },
  },
];

/**
 * Get colors based on the current display mode (solids vs gradients)
 */
export function getThemeColors(showGradients: boolean): ThemeColor[] {
  return showGradients ? gradientColors : solidColors;
}

/**
 * Get the appropriate variant based on dark mode
 */
export function getThemeVariant(
  colorPair: ThemeColor,
  isDarkMode: boolean
): ThemeVariant {
  return isDarkMode ? colorPair.dark : colorPair.light;
}
