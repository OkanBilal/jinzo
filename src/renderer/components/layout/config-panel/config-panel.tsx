import { useState, useEffect } from "react";
import { Config, ConfigClose } from "@/components/ui/icons";
import { Heading3 } from "@/components/ui/text";
import { FrostedButton } from "@/components/ui/button";
import { useActiveMood } from "@/hooks/useActiveMood";
import { PanelContent } from "./panel-content";
import { JournalContent } from "./journal-content";

const FADE_IN_DELAY = 50;

interface ConfigPanelProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  width?: string;
}

export default function ConfigPanel({
  isOpen,
  onToggle,
  width = "40rem",
}: ConfigPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { isJournalMood } = useActiveMood();

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
      />
      <Panel
        isVisible={isVisible}
        width={width}
        isJournalMood={isJournalMood}
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
      aria-label={isOpen ? "Close configuration" : "Open configuration"}
    >
      {isOpen ? (
        <ConfigClose className="w-4.5 h-4.5" />
      ) : (
        <Config className="w-4.5 h-4.5" />
      )}
    </FrostedButton>
  );
}

interface PanelProps {
  isVisible: boolean;
  width: string;
  isJournalMood: boolean;
}

function Panel({ isVisible, width, isJournalMood }: PanelProps) {
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
      aria-label="Configuration panel"
    >
      {!isJournalMood && (
        <div className="flex items-center justify-between px-4 pt-6 ">
          <Heading3>Configuration</Heading3>
        </div>
      )}
      {isJournalMood ? <JournalContent /> : <PanelContent />}
    </div>
  );
}
