import { Button } from "@/components/ui/button";
import { Microphone } from "@/components/ui/icons";
import type { InputVariant } from "./send-button";

interface DictationButtonProps {
  isRecording: boolean;
  onToggle: () => void;
  variant?: InputVariant;
}

const variantStyles = {
  default: {
    recording: "bg-primary-300 dark:bg-primary-700/50",
    hover: "hover:bg-primary-200/30 dark:hover:bg-primary/20",
    icon: "dark:text-primary-400 text-primary-500",
  },
  copilot: {
    recording: "bg-copilot-blue/30 dark:bg-copilot-lightblue/50",
    hover: "hover:bg-copilot-blue/30 dark:hover:bg-copilot-lightblue/20",
    icon: "dark:text-copilot-lightblue text-copilot-blue",
  },
};

export function DictationButton({
  isRecording,
  onToggle,
  variant = "default",
}: DictationButtonProps) {
  const styles = variantStyles[variant];

  const buttonClass = `p-1.5 mr-2 rounded-full transition-all duration-200 ${
    isRecording
      ? `${styles.recording} animate-pulse`
      : styles.hover
  }`;

  return (
    <Button
      tooltip="Open dictation"
      type="button"
      onClick={onToggle}
      className={buttonClass}
      aria-label={isRecording ? "Stop recording" : "Start voice input"}
      title={isRecording ? "Stop recording" : "Voice input"}
    >
      <Microphone
        className={styles.icon}
        isRecording={isRecording}
      />
    </Button>
  );
}
