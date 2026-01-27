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

export const solidColors: ThemeColor[] = [
  {
    name: "Rose Quartz",
    light: { value: "#F3E4E7", preview: "#F3E4E7" },
    dark: { value: "#433d30e6", preview: "#433d30" },
  },
  {
    name: "Cider Brown",
    light: { value: "#F6EAE7", preview: "#F6EAE7" },
    dark: { value: "#54241ce6", preview: "#54241c" },
  },
  {
    name: "Rust Plum",
    light: { value: "#F3E4E7", preview: "#F3E4E7" },
    dark: { value: "#281d36e6", preview: "#281d36" },
  },
  {
    name: "Deep Forest",
    light: { value: "#DCEDE3", preview: "#DCEDE3" },
    dark: { value: "#0b2d1ae6", preview: "#0b2d1a" },
  },
      {
    name: "Warm Clay",
    light: { value: "#F4E9DD", preview: "#F4E9DD" },
    dark: { value: "#1d2423e6", preview: "#1d2423" },
  },
  {
    name: "Indigo Steel",
    light: { value: "#DEE6F3", preview: "#DEE6F3" },
    dark: { value: "#19263ce6", preview: "#19263c" },
  },
  {
    name: "Deep Grape",
    light: { value: "#E9E4F1", preview: "#E9E4F1" },
    dark: { value: "#1c1e27e6", preview: "#1c1e27" },
  },
];

// 8 Gradient Colors - light variants are soft pastels, dark variants are deep/rich
export const gradientColors: ThemeColor[] = [
{
  name: "Deep Grape",
  light: {
    value: "linear-gradient(180deg, #F2EEFA 0%, #E3DDF1 100%)",
    preview: "linear-gradient(135deg, #F2EEFA 0%, #E3DDF1 100%)",
  },
  dark: {
    value: "linear-gradient(180deg, #3A3241 0%, #2A2430 100%)",
    preview: "linear-gradient(135deg, #3A3241 0%, #2A2430 100%)",
  },
},
{
  name: "Rust Plum",
  light: {
    value: "linear-gradient(180deg, #FBEAEC 0%, #EEDDE0 100%)",
    preview: "linear-gradient(135deg, #FBEAEC 0%, #EEDDE0 100%)",
  },
  dark: {
    value: "linear-gradient(180deg, #473138 0%, #312127 100%)",
    preview: "linear-gradient(135deg, #473138 0%, #312127 100%)",
  },
},
{
  name: "Cider Brown",
  light: {
    value: "linear-gradient(180deg, #FFF1EE 0%, #F0E1DE 100%)",
    preview: "linear-gradient(135deg, #FFF1EE 0%, #F0E1DE 100%)",
  },
  dark: {
    value: "linear-gradient(180deg, #503835 0%, #362422 100%)",
    preview: "linear-gradient(135deg, #503835 0%, #362422 100%)",
  },
},
{
  name: "Warm Clay",
  light: {
    value: "linear-gradient(180deg, #FCEFE1 0%, #EEDFCC 100%)",
    preview: "linear-gradient(135deg, #FCEFE1 0%, #EEDFCC 100%)",
  },
  dark: {
    value: "linear-gradient(180deg, #5E4837 0%, #3E2F24 100%)",
    preview: "linear-gradient(135deg, #5E4837 0%, #3E2F24 100%)",
  },
},
{
  name: "Sage Mist",
  light: {
    value: "linear-gradient(180deg, #FAF9F0 0%, #ECEBDE 100%)",
    preview: "linear-gradient(135deg, #FAF9F0 0%, #ECEBDE 100%)",
  },
  dark: {
    value: "linear-gradient(180deg, #8E8D78 0%, #6A6A59 100%)",
    preview: "linear-gradient(135deg, #8E8D78 0%, #6A6A59 100%)",
  },
},
{
  name: "Deep Forest",
  light: {
    value: "linear-gradient(180deg, #E7F6ED 0%, #D4E7DC 100%)",
    preview: "linear-gradient(135deg, #E7F6ED 0%, #D4E7DC 100%)",
  },
  dark: {
    value: "linear-gradient(180deg, #395D4C 0%, #22382E 100%)",
    preview: "linear-gradient(135deg, #395D4C 0%, #22382E 100%)",
  },
},
{
  name: "Indigo Steel",
  light: {
    value: "linear-gradient(180deg, #ECF1FB 0%, #D6E1F5 100%)",
    preview: "linear-gradient(135deg, #ECF1FB 0%, #D6E1F5 100%)",
  },
  dark: {
    value: "linear-gradient(180deg, #33486A 0%, #1E2B41 100%)",
    preview: "linear-gradient(135deg, #33486A 0%, #1E2B41 100%)",
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
