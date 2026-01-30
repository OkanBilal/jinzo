export interface ThemeVariant {
  value: string;
  preview: string;
}

export interface ThemeColor {
  name: string;
  light: ThemeVariant;
  dark: ThemeVariant;
}

const solid = (light: string, dark: string, darkAlpha = "e6"): ThemeColor => ({
  name: "",
  light: { value: light, preview: light },
  dark: { value: `${dark}${darkAlpha}`, preview: dark },
});

export const solidColors: ThemeColor[] = [
  { ...solid("#F3E4E7", "#433d30"), name: "Rose Quartz" },
  { ...solid("#F6EAE7", "#54241c"), name: "Cider Brown" },
  { ...solid("#F3E4E7", "#281d36"), name: "Rust Plum" },
  { ...solid("#DCEDE3", "#0b2d1a"), name: "Deep Forest" },
  { ...solid("#F4E9DD", "#1d2423"), name: "Warm Clay" },
  { ...solid("#DEE6F3", "#19263c"), name: "Indigo Steel" },
  { ...solid("#E9E4F1", "#1c1e27"), name: "Deep Grape" },
];

const gradient = (
  lightFrom: string,
  lightTo: string,
  darkFrom: string,
  darkTo: string,
): Omit<ThemeColor, "name"> => ({
  light: {
    value: `linear-gradient(180deg, ${lightFrom} 0%, ${lightTo} 100%)`,
    preview: `linear-gradient(135deg, ${lightFrom} 0%, ${lightTo} 100%)`,
  },
  dark: {
    value: `linear-gradient(180deg, ${darkFrom} 0%, ${darkTo} 100%)`,
    preview: `linear-gradient(135deg, ${darkFrom} 0%, ${darkTo} 100%)`,
  },
});

export const gradientColors: ThemeColor[] = [
  {
    name: "Deep Grape",
    ...gradient("#917db9cc", "#E3DDF1", "#3A3241", "#2A2430"),
  },
  {
    name: "Rust Plum",
    ...gradient("#bc8a90cc", "#EEDDE0", "#473138", "#312127"),
  },
  {
    name: "Cider Brown",
    ...gradient("#d5a59acc", "#F0E1DE", "#503835", "#362422"),
  },
  {
    name: "Warm Clay",
    ...gradient("#e7ae70cc", "#EEDFCC", "#5E4837", "#3E2F24"),
  },
  {
    name: "Sage Mist",
    ...gradient("#b7af65cc", "#ECEBDE", "#8E8D78", "#6A6A59"),
  },
  {
    name: "Deep Forest",
    ...gradient("#6e977ecc", "#D4E7DC", "#395D4C", "#22382E"),
  },
  {
    name: "Indigo Steel",
    ...gradient("#7090d0cc", "#D6E1F5", "#33486A", "#1E2B41"),
  },
];

export const getThemeColors = (showGradients: boolean): ThemeColor[] =>
  showGradients ? gradientColors : solidColors;

export const getThemeVariant = (
  colorPair: ThemeColor,
  isDarkMode: boolean,
): ThemeVariant => (isDarkMode ? colorPair.dark : colorPair.light);

export type { ThemeVariant as MoodThemeVariant, ThemeColor as MoodThemeColor };
