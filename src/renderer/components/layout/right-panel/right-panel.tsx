import { useReducer, useEffect } from "react";
import { useLayoutConfig } from "@/hooks/use-layout-config";
import { ToggleButton } from "./toggle-button";
import { Panel } from "./panel";

type AnimationState = "closed" | "opening" | "open" | "closing";

interface RightPanelProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  width?: string;
  terminalOpen?: boolean;
  onTerminalToggle?: () => void;
  browserOpen?: boolean;
  onBrowserToggle?: () => void;
}

export default function RightPanel({
  isOpen,
  onToggle,
  width = "0rem",
  terminalOpen,
  onTerminalToggle,
  browserOpen,
  onBrowserToggle,
}: RightPanelProps) {
  const [animationState, dispatch] = useReducer(
    (_: AnimationState, next: AnimationState) => next,
    isOpen ? "open" : ("closed" as AnimationState),
  );
  const { rightPanelComponent } = useLayoutConfig();

  const handleToggle = () => onToggle(!isOpen);

  useEffect(() => {
    dispatch(isOpen ? "opening" : "closing");
  }, [isOpen]);

  useEffect(() => {
    if (animationState === "opening") {
      const timer = setTimeout(() => dispatch("open"), 50);
      return () => clearTimeout(timer);
    }
    if (animationState === "closing") {
      const timer = setTimeout(() => dispatch("closed"), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [animationState]);

  const isVisible = animationState !== "closed";
  const isAnimatedIn = animationState === "open";

  return (
    <>
      <ToggleButton
        isOpen={isOpen}
        onClick={handleToggle}
        terminalOpen={terminalOpen}
        onTerminalToggle={onTerminalToggle}
        browserOpen={browserOpen}
        onBrowserToggle={onBrowserToggle}
      />
      <Panel
        isVisible={isVisible}
        isAnimatedIn={isAnimatedIn}
        width={width}
        component={rightPanelComponent}
      />
    </>
  );
}
