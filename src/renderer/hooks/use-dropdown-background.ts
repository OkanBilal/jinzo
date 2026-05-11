import { useMemo } from "react";
import { useActiveSpace } from "./use-active-space";
import { useDarkMode } from "./use-dark-mode";
import { getDefaultDropdownBackground } from "@/lib/theme";

/**
 * Computes the dropdown background color/gradient for the active space.
 * Pass `disabled = true` to skip the lookup (caller uses a fixed background instead).
 */
export function useDropdownBackground(
  opacity?: number,
  disabled = false,
): string | undefined {
  const { activeSpace } = useActiveSpace();
  const { darkMode } = useDarkMode();

  return useMemo(() => {
    if (disabled) return undefined;

    const fallback = () =>
      opacity === undefined
        ? getDefaultDropdownBackground(darkMode)
        : getDefaultDropdownBackground(darkMode, opacity);

    if (!activeSpace?.themeConfig) return fallback();

    try {
      const cfg = JSON.parse(activeSpace.themeConfig);
      const bgColor = darkMode ? cfg.darkBackground : cfg.lightBackground;
      if (!bgColor) return fallback();
      if (bgColor.startsWith("linear-gradient")) return bgColor;
      return bgColor.length === 9 ? bgColor.slice(0, 7) : bgColor;
    } catch {
      return fallback();
    }
  }, [disabled, activeSpace, darkMode, opacity]);
}
