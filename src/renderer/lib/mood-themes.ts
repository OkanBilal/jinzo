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
    light: { value: "#E6C7E699", preview: "#E6C7E6" },
    dark: { value: "#C5683F", preview: "#C5683F" },
  },
  {
    name: "Crimson",
    light: { value: "#FBE4E399", preview: "#FBE4E3" },
    dark: { value: "#f4433690", preview: "#3F0D12" },
  },
  {
    name: "Mahogany",
    light: { value: "#FADADD99", preview: "#FADADD" },
    dark: { value: "#66678990", preview: "#3B1F1B" },
  },
  {
    name: "Sunset",
    light: { value: "#FFF3C499", preview: "#FFF3C4" },
    dark: { value: "#3D351A90", preview: "#3D351A" },
  },
  {
    name: "Peach",
    light: { value: "#fcc7b699", preview: "#fcc7b6" },
    dark: { value: "#87553390", preview: "#875533" },
  },
  {
    name: "Evergreen",
    light: { value: "#D1F2EB99", preview: "#D1F2EB" },
    dark: { value: "#00A24E90", preview: "#013220" },
  },
  {
    name: "Ocean",
    light: { value: "#D6E6F399", preview: "#D6E6F3" },
    dark: { value: "#00092690", preview: "#000926" },
  },
  {
    name: "Lavender",
    light: { value: "#E8D5F799", preview: "#E8D5F7" },
    dark: { value: "#4B367C90", preview: "#4B367C" },
  },
];

// 8 Gradient Colors - light variants are soft pastels, dark variants are deep/rich
export const gradientColors: ThemeColor[] = [
  {
    name: "Ocean Waves",
    light: {
      value: "linear-gradient(0deg, #4BE1F4 0%, #A5C3C3 50%, #DBD7CA 100%)",
      preview: "linear-gradient(135deg, #4BE1F4 0%, #A5C3C3 50%, #DBD7CA 100%)",
    },
    dark: {
      value:
        "linear-gradient(180deg, #22336B 0%, #196AB4 33%, #CE8A63 66%, #C5683F 100%)",
      preview:
        "linear-gradient(135deg, #22336B 0%, #196AB4 33%, #CE8A63 66%, #C5683F 100%)",
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
  {
    name: "Mystic Forest",
    light: {
      value: "linear-gradient(180deg, #DCFCE7 0%, #BBF7D0 100%)",
      preview: "linear-gradient(180deg, #DCFCE7 0%, #BBF7D0 100%)",
    },
    dark: {
      value: "linear-gradient(180deg, #1A2A1A 0%, #0A1A0A 100%)",
      preview: "linear-gradient(180deg, #2A3A2A 0%, #1A2A1A 100%)",
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
  isDarkMode: boolean,
): ThemeVariant {
  return isDarkMode ? colorPair.dark : colorPair.light;
}
