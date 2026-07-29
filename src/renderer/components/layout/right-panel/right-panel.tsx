import { useEffect, useLayoutEffect, useReducer } from "react";
import { useLayoutConfig } from "@/hooks/use-layout-config";
import { useIsMobile } from "@/lib/platform";
import { useAppSelector } from "@/lib/redux/hooks";
import { LAYOUT_PANEL_ANIM_MS } from "@/lib/layout";
import { ToggleButton } from "./toggle-button";
import { Panel } from "./panel";

type AnimationState = "closed" | "opening" | "open" | "closing";

interface RightPanelProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  width?: string;
  providerId?: string;
  terminalOpen?: boolean;
  onTerminalToggle?: () => void;
  browserOpen?: boolean;
  onBrowserToggle?: () => void;
}

export default function RightPanel({
  isOpen,
  onToggle,
  width = "0rem",
  providerId,
  terminalOpen,
  onTerminalToggle,
  browserOpen,
  onBrowserToggle,
}: RightPanelProps) {
  const [animationState, dispatch] = useReducer(
    (state: AnimationState, next: AnimationState) => {
      if (next === "opening") {
        return state === "open" || state === "opening" ? state : "opening";
      }
      if (next === "closing") {
        return state === "closed" || state === "closing" ? state : "closing";
      }
      return next;
    },
    isOpen ? "open" : ("closed" as AnimationState),
  );
  const { rightPanelComponent } = useLayoutConfig();
  const isMobile = useIsMobile();
  const sidebarCollapsed = useAppSelector((s) => s.appSettings.sidebarCollapsed);
  // On mobile the sidebar is a full-width drawer; hide the right toggle cluster
  // (Git / terminal / panel) while it's open so it sits behind the drawer.
  const hideToggleCluster = isMobile && !sidebarCollapsed;

  const handleToggle = () => onToggle(!isOpen);

  useLayoutEffect(() => {
    dispatch(isOpen ? "opening" : "closing");
  }, [isOpen]);

  useEffect(() => {
    if (animationState === "opening") {
      const frameId = requestAnimationFrame(() => dispatch("open"));
      return () => cancelAnimationFrame(frameId);
    }
    if (animationState === "closing") {
      const timer = setTimeout(() => dispatch("closed"), LAYOUT_PANEL_ANIM_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [animationState]);

  const isVisible = animationState !== "closed";
  const isAnimatedIn = animationState === "open";

  return (
    <>
      {!hideToggleCluster && (
        <ToggleButton
          isOpen={isOpen}
          onClick={handleToggle}
          terminalOpen={terminalOpen}
          onTerminalToggle={onTerminalToggle}
          browserOpen={browserOpen}
          onBrowserToggle={onBrowserToggle}
          providerId={providerId}
        />
      )}
      <Panel
        isVisible={isVisible}
        isAnimatedIn={isAnimatedIn}
        width={width}
        component={rightPanelComponent}
      />
    </>
  );
}
