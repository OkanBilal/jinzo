import { useMemo } from "react";
import { useParsedUiConfig } from "./use-parsed-ui-config";

interface LayoutConfig {
  rightPanelComponent: string;
}

export function useLayoutConfig(): LayoutConfig {
  const uiConfig = useParsedUiConfig();
  return useMemo(
    () => ({
      rightPanelComponent: uiConfig.rightPanel?.component || "config",
    }),
    [uiConfig],
  );
}
