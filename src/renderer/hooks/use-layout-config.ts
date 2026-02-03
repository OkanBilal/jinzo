import { useMemo } from "react";
import { useActiveMood } from "./use-active-mood";

interface LayoutConfig {
  mainMarginLeft: string;
  rightPanelWidth: string;
  rightPanelComponent: string;
}

export function useLayoutConfig(): LayoutConfig {
  const { activeMood } = useActiveMood();

  return useMemo(() => {
    const defaults: LayoutConfig = {
      mainMarginLeft: "19rem",
      rightPanelWidth: "19rem",
      rightPanelComponent: "config",
    };

    if (!activeMood?.uiConfig) {
      return defaults;
    }

    try {
      const config = JSON.parse(activeMood.uiConfig);
      return {
        mainMarginLeft: config.main?.margin || defaults.mainMarginLeft,
        rightPanelWidth: config.rightPanel?.width || defaults.rightPanelWidth,
        rightPanelComponent: config.rightPanel?.component || defaults.rightPanelComponent,
      };
    } catch (error) {
      console.error("Failed to parse mood uiConfig:", error);
      return defaults;
    }
  }, [activeMood]);
}
