import { useLayoutConfig } from "@/hooks/use-layout-config";
import { usePanelAnimation } from "@/hooks/use-panel-animation";
import { useIsMobile } from "@/lib/platform";
import { useAppSelector } from "@/lib/redux/hooks";
import { ToggleButton } from "./toggle-button";
import { Panel } from "./panel";

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
  const { isVisible, isAnimatedIn } = usePanelAnimation(isOpen);
  const { rightPanelComponent } = useLayoutConfig();
  const isMobile = useIsMobile();
  const sidebarCollapsed = useAppSelector((s) => s.appSettings.sidebarCollapsed);
  // On mobile the sidebar is a full-width drawer; hide the right toggle cluster
  // (Git / terminal / panel) while it's open so it sits behind the drawer.
  const hideToggleCluster = isMobile && !sidebarCollapsed;

  const handleToggle = () => onToggle(!isOpen);

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
