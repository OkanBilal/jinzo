import { useState, useEffect } from "react";
import { Close, RightPanelClose, RightPanelOpen } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useLayoutConfig } from "@/hooks/use-layout-config";
import { ConfigContent } from "./config-content";
import { JournalContent } from "./journal-content";
import { WorkspaceContent } from "./workspace-content";


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
  const [isVisible, setIsVisible] = useState(false);
  const { rightPanelComponent } = useLayoutConfig();

  const FADE_IN_DELAY = isOpen ? 20 : 60;


  const handleToggle = () => onToggle(!isOpen);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isOpen) {
      timer = setTimeout(() => setIsVisible(true), FADE_IN_DELAY);
    } else {
      timer = setTimeout(() => setIsVisible(false), 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

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

function ToggleButton({ isOpen, width, onClick, isWorkspace = false }: ToggleButtonProps) {

  return (
    <Button
      tooltip={isOpen ? "Close right panel" : "Open right panel"}
      tooltipPosition="left"
      onClick={onClick}
      className={`fixed z-60 rounded-full! p-1.5! text-primary-900 dark:text-primary-300!  bg-primary-200/30 dark:bg-primary-50/10 transition-all duration-300 ease-out top-3 right-3 `}
      aria-label={isOpen ? "Close right panel" : "Open right panel"}
    >
      {isOpen ? (
        <Close  className="size-3.5 " />
      ) : (
        <RightPanelOpen className="size-4" />
      )}
    </Button>
  );
}

interface PanelProps {
  isVisible: boolean;
  width: string;
  component: string;
}

// TODO move to separate file
const PANEL_COMPONENTS: Record<string, React.ComponentType> = {
  config: ConfigContent,
  journal: JournalContent,
  workspace: WorkspaceContent,
  claude: WorkspaceContent
};

function Panel({ isVisible, width, component }: PanelProps) {
  const PanelContent = PANEL_COMPONENTS[component] || ConfigContent;

  return (
    <div
      className={`block fixed top-0 bottom-0 right-0 overflow-hidden transition-all duration-300 ease-in-out  bg-transparent ${
        isVisible ? "translate-x-0 z-50 " : "pointer-events-none"
      }`}
      style={{
        width: width,
        transform: isVisible ? "translateX(0)" : `translateX(${width})`,
        zIndex: isVisible ? 50 : -10,
      }}
      role="complementary"
      aria-label="Right panel"
    >
      <PanelContent />
    </div>
  );
}
