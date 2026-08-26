import { Color } from "expo-router";
import { Platform, useColorScheme } from "react-native";

/**
 * Platform semantic colors — resolved on-device, adapt to light/dark and
 * accessibility settings by themselves. These are static-safe: token files
 * may import them at module scope.
 */
export const colors = {
  label: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: "#000000",
  })!,
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#3c3c43",
  })!,
  tertiaryLabel: Platform.select({
    ios: Color.ios.tertiaryLabel,
    android: Color.android.dynamic.outline,
    default: "#8e8e93",
  })!,
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: "#c6c6c8",
  })!,
  systemBackground: Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    default: "#ffffff",
  })!,
  secondarySystemBackground: Platform.select({
    ios: Color.ios.secondarySystemBackground,
    android: Color.android.dynamic.surfaceContainer,
    default: "#f2f2f7",
  })!,
  tertiarySystemBackground: Platform.select({
    ios: Color.ios.tertiarySystemBackground,
    android: Color.android.dynamic.surfaceContainerHigh,
    default: "#ffffff",
  })!,
  groupedBackground: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.surface,
    default: "#f2f2f7",
  })!,
  groupedCell: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.surfaceContainer,
    default: "#ffffff",
  })!,
  fill: Platform.select({
    ios: Color.ios.systemFill,
    android: Color.android.dynamic.surfaceVariant,
    default: "rgba(120,120,128,0.2)",
  })!,
  systemBlue: Platform.select({
    ios: Color.ios.systemBlue,
    android: Color.android.dynamic.primary,
    default: "#007aff",
  })!,
  systemGreen: Platform.select({
    ios: Color.ios.systemGreen,
    android: Color.android.dynamic.tertiary,
    default: "#34c759",
  })!,
  systemRed: Platform.select({
    ios: Color.ios.systemRed,
    android: Color.android.dynamic.error,
    default: "#ff3b30",
  })!,
  systemOrange: Platform.select({
    ios: Color.ios.systemOrange,
    android: Color.android.dynamic.tertiary,
    default: "#ff9500",
  })!,
  // Deliberately fixed: text on a tinted (accent) surface stays white in both modes.
  onTint: "#ffffff",
};

/**
 * Brand colors — the only place the phone borrows literal values from the
 * desktop (`src/renderer/index.css`: accent #2563eb over a neutral scale).
 * Hook-only: apply inside components at render time.
 */
const brandPalette = {
  light: { accent: "#2563eb", accentSoft: "rgba(37, 99, 235, 0.12)", accentContrast: "#ffffff" },
  dark: { accent: "#3b82f6", accentSoft: "rgba(59, 130, 246, 0.18)", accentContrast: "#ffffff" },
} as const;

export function useBrandColors() {
  const scheme = useColorScheme();
  return brandPalette[scheme === "dark" ? "dark" : "light"];
}

/** Run / tool-call status → color. Running borrows the brand accent. */
export function useStatusColors() {
  const brand = useBrandColors();
  return {
    running: brand.accent,
    queued: colors.secondaryLabel,
    succeeded: colors.systemGreen,
    done: colors.systemGreen,
    failed: colors.systemRed,
    error: colors.systemRed,
    canceled: colors.tertiaryLabel,
  } as const;
}

/**
 * Provider brand colors, lifted from the desktop's `--color-claude`,
 * `--color-copilot`, `--color-codex` and `--color-cursor`
 * (`src/renderer/index.css`) and keyed by the contract's provider ids, so a run
 * can look up the color of the agent that produced it.
 *
 * Text over a filled one of these is `colors.onTint` — white, in both modes,
 * for every provider. Claude's orange carries white at 3.1:1 rather than the
 * 4.5:1 body text usually wants; that is a deliberate call for the brand hue
 * over the ratio, and the bubble is short, high-weight text.
 */
const providerAccents = {
  claude_code: "#D97757",
  copilot_cli: "#8534F3",
  codex: "#0169CC",
  cursor: "#727272",
} as const;

/** A provider's brand color, falling back to the app's own accent. */
export function useProviderAccent(providerId: string | null | undefined): string {
  const brand = useBrandColors();
  return providerAccents[providerId as keyof typeof providerAccents] ?? brand.accent;
}
