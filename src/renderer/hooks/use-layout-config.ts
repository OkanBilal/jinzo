import { useMemo } from "react";
import { useActiveSpace } from "./use-active-space";

interface LayoutConfig {
  mainMarginLeft: string;
  rightPanelWidth: string;
  rightPanelComponent: string;
}

export function useLayoutConfig(): LayoutConfig {
  const { activeSpace } = useActiveSpace();

  return useMemo(() => {
    const defaults: LayoutConfig = {
      mainMarginLeft: "var(--sidebar-width)",
      rightPanelWidth: "var(--panel-width)",
      rightPanelComponent: "config",
    };

    if (!activeSpace?.uiConfig) {
      return defaults;
    }

    try {
      const config = JSON.parse(activeSpace.uiConfig);
      return {
        mainMarginLeft: config.main?.margin || defaults.mainMarginLeft,
        rightPanelWidth: config.rightPanel?.width || defaults.rightPanelWidth,
        rightPanelComponent: config.rightPanel?.component || defaults.rightPanelComponent,
      };
    } catch (error) {
      console.error("Failed to parse space uiConfig:", error);
      return defaults;
    }
  }, [activeSpace]);
}
