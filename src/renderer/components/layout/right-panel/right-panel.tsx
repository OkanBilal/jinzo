import { useReducer, useEffect, useRef } from "react";
import { useLayoutConfig } from "@/hooks/use-layout-config";
import { ToggleButton } from "./toggle-button";
import { Panel } from "./panel";

type AnimationState = "closed" | "opening" | "open" | "closing";

interface RightPanelProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  width?: string;
}

export default function RightPanel({
  isOpen,
  onToggle,
  width = "0rem",
}: RightPanelProps) {
  const [animationState, dispatch] = useReducer(
    (_: AnimationState, next: AnimationState) => next,
    isOpen ? "open" : ("closed" as AnimationState),
  );
  const { rightPanelComponent } = useLayoutConfig();

  const handleToggle = () => onToggle(!isOpen);

  const prevIsOpen = useRef(isOpen);
  if (isOpen !== prevIsOpen.current) {
    prevIsOpen.current = isOpen;
    dispatch(isOpen ? "opening" : "closing");
  }

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
      <ToggleButton isOpen={isOpen} onClick={handleToggle} />
      <Panel
        isVisible={isVisible}
        isAnimatedIn={isAnimatedIn}
        width={width}
        component={rightPanelComponent}
      />
    </>
  );
}
