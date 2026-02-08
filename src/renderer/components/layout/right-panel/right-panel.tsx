import { useState, useEffect } from "react";
import { Close, RightPanelOpen } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useLayoutConfig } from "@/hooks/use-layout-config";
import { ConfigContent } from "./config-content";
import { JournalContent } from "./journal-content";
import { WorkspaceSidebar } from "@/features/workspace/components/workspace-sidebar";

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
  const [animationState, setAnimationState] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const { rightPanelComponent } = useLayoutConfig();

  const handleToggle = () => onToggle(!isOpen);

  useEffect(() => {
    if (isOpen) {
      // Start opening: first mount (set to opening), then animate in
      setAnimationState("opening");
      const timer = setTimeout(() => setAnimationState("open"), 50);
      return () => clearTimeout(timer);
    } else {
      // Start closing: animate out, then unmount
      setAnimationState("closing");
      const timer = setTimeout(() => setAnimationState("closed"), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const isVisible = animationState !== "closed";
  const isAnimatedIn = animationState === "open";

  return (
    <>
      <ToggleButton
        isOpen={isOpen}
        width={width}
        onClick={handleToggle}
        isWorkspace={rightPanelComponent === "workspace"}
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

interface ToggleButtonProps {
  isOpen: boolean;
  width: string;
  onClick: () => void;
  isWorkspace?: boolean;
}

function ToggleButton({
  isOpen,
  width,
  onClick,
  isWorkspace = false,
}: ToggleButtonProps) {
  return (
    <Button
      tooltip={isOpen ? "Close right panel" : "Open right panel"}
      tooltipPosition="left"
      onClick={onClick}
      className={`fixed z-60 rounded-full! p-2! text-primary-900 dark:text-primary-300!  bg-primary-100/30 dark:bg-primary/5 transition-all duration-300 ease-out top-3 right-3 `}
      aria-label={isOpen ? "Close right panel" : "Open right panel"}
    >
      {isOpen ? (
        <Close className="size-3.5 " />
      ) : (
        <RightPanelOpen className="size-4" />
      )}
    </Button>
  );
}

interface PanelProps {
  isVisible: boolean;
  isAnimatedIn: boolean;
  width: string;
  component: string;
}

const PANEL_COMPONENTS: Record<string, React.ComponentType> = {
  config: ConfigContent,
  journal: JournalContent,
  workspace: WorkspaceSidebar,
  claude: WorkspaceSidebar,
};

function Panel({ isVisible, isAnimatedIn, width, component }: PanelProps) {
  const PanelContent = PANEL_COMPONENTS[component] || ConfigContent;

  if (!isVisible) return null;

  return (
    <div
      className={`block fixed top-0 bottom-0 right-0 overflow-hidden transition-all duration-300 ease-out bg-transparent z-50`}
      style={{
        width: width,
        transform: isAnimatedIn ? "translateX(0)" : `translateX(100%)`,
        opacity: isAnimatedIn ? 1 : 0,
      }}
      role="complementary"
      aria-label="Right panel"
    >
      <PanelContent />
    </div>
  );
}
