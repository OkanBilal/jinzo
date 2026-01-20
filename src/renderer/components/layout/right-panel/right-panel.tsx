import { useState, useEffect } from "react";
import { RightPanelClose, RightPanelOpen } from "@/components/ui/icons";
import { FrostedButton } from "@/components/ui/button";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { ConfigContent } from "./config-content";
import { JournalContent } from "./journal-content";

const FADE_IN_DELAY = 50;

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
      <ToggleButton isOpen={isOpen} width={width} onClick={handleToggle} />
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
}

function ToggleButton({ isOpen, width, onClick }: ToggleButtonProps) {
  return (
    <FrostedButton
      onClick={onClick}
      className={`fixed z-40 p-2.5 rounded-full transition-all duration-300 ease-out ${
        isOpen ? "right-[calc(var(--config-width)+1.75rem)]" : "top-7 right-5"
      }`}
      style={
        isOpen
          ? ({
              "--config-width": width,
              top: "1.75rem",
            } as React.CSSProperties)
          : ({ top: "1.75rem", right: "1.25rem" } as React.CSSProperties)
      }
      aria-label={isOpen ? "Close right panel" : "Open right panel"}
    >
      {isOpen ? (
        <RightPanelClose className="w-4.5 h-4.5" />
      ) : (
        <RightPanelOpen className="w-4.5 h-4.5" />
      )}
    </FrostedButton>
  );
}

interface PanelProps {
  isVisible: boolean;
  width: string;
  component: string;
}

const PANEL_COMPONENTS: Record<string, React.ComponentType> = {
  config: ConfigContent,
  journal: JournalContent,
};

function Panel({ isVisible, width, component }: PanelProps) {
  const PanelContent = PANEL_COMPONENTS[component] || ConfigContent;

  return (
    <div
      className={`block fixed top-0 bottom-0 right-0 overflow-hidden transition-all duration-300 ease-out bg-transparent ${
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
