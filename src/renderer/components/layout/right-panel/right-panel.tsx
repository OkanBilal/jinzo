import { useState, useEffect } from "react";
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
  const [animationState, setAnimationState] = useState<AnimationState>("closed");
  const { rightPanelComponent } = useLayoutConfig();

  const handleToggle = () => onToggle(!isOpen);

  useEffect(() => {
    if (isOpen) {
      setAnimationState("opening");
      const timer = setTimeout(() => setAnimationState("open"), 50);
      return () => clearTimeout(timer);
    } else {
      setAnimationState("closing");
      const timer = setTimeout(() => setAnimationState("closed"), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
