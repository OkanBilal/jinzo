import { useMemo } from "react";
import { useActiveSpace } from "./use-active-space";
import { parseUiConfig, type ParsedUiConfig } from "@/lib/parse-ui-config";

/**
 * Memoized parse of the active space's `uiConfig` blob. Re-parses only when
 * the underlying JSON string changes — so multiple consumers (sidebar /
 * layout / future widgets) share a single parse per space switch.
 */
export function useParsedUiConfig(): ParsedUiConfig {
  const { activeSpace } = useActiveSpace();
  const raw = activeSpace?.uiConfig ?? null;
  return useMemo(() => parseUiConfig(raw), [raw]);
}
