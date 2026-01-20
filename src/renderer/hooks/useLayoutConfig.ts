import { useMemo } from "react";
import { useActiveMood } from "./useActiveMood";

interface LayoutConfig {
  mainMarginLeft: string;
  configPanelWidth: string;
}

export function useLayoutConfig(): LayoutConfig {
  const { activeMood } = useActiveMood();

  return useMemo(() => {
    const defaults: LayoutConfig = {
      mainMarginLeft: "18rem",
      configPanelWidth: "18rem",
    };

    if (!activeMood?.uiConfig) {
      return defaults;
    }

    try {
      const config = JSON.parse(activeMood.uiConfig);
      return {
        mainMarginLeft: config.main?.margin || defaults.mainMarginLeft,
        configPanelWidth: config.configPanel?.width || defaults.configPanelWidth,
      };
    } catch (error) {
      console.error("Failed to parse mood uiConfig:", error);
      return defaults;
    }
  }, [activeMood]);
}
