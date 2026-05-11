import { useMemo } from "react";
import { useParsedUiConfig } from "./use-parsed-ui-config";

interface LayoutConfig {
  mainMarginLeft: string;
  rightPanelWidth: string;
  rightPanelComponent: string;
}

export function useLayoutConfig(): LayoutConfig {
  const uiConfig = useParsedUiConfig();
  return useMemo(
    () => ({
      mainMarginLeft: uiConfig.main?.margin || "var(--sidebar-width)",
      rightPanelWidth: uiConfig.rightPanel?.width || "var(--panel-width)",
      rightPanelComponent: uiConfig.rightPanel?.component || "config",
    }),
    [uiConfig],
  );
}
