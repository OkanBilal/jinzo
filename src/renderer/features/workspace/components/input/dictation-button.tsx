import { Button } from "@/components/ui/button";
import { Microphone } from "../../../../components/ui/icons";


export default function DictationButton({
  isRecording,
  onToggle,
}: DictationButtonProps) {
  const buttonClass = `p-1.5 mr-2 rounded-full transition-all duration-200 ${
    isRecording
      ? "bg-copilot-blue/30 dark:bg-copilot-lightblue/50 animate-pulse"
      : "hover:bg-copilot-blue/30 dark:hover:bg-copilot-lightblue/20"
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
        className="dark:text-copilot-lightblue text-copilot-blue"
        isRecording={isRecording}
      />
    </Button>
  );
}

interface DictationButtonProps {
  isRecording: boolean;
  onToggle: () => void;
}