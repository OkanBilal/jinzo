import { useEffect } from "react";
import { Plus } from "@/components/ui/icons";
import { Body, Caption } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface NewButtonProps {
  onClick: () => void;
  title: string;
  actionPrefix?: string;
}

export default function NewButton({ onClick, title, actionPrefix = "New" }: NewButtonProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "n") {
        e.preventDefault();
        onClick();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClick]);

  return (
    <Button
      tooltip={`${actionPrefix} ${title}`}
      variant="subtle"
      tooltipShortcut="⌘N"
      size="lg"
      onClick={onClick}
      fullWidth
      className="justify-start cursor-pointer p-4 hover:scale-101 transition-transform duration-200"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <Plus className="w-4 h-4 text-primary-900 dark:text-primary-400" />
      <Body className="text-primary-900 dark:text-primary-100 font-medium">
        {actionPrefix} {title}
      </Body>
      <Caption className="ml-auto text-primary-900 dark:text-primary-400">
        ⌘ N
      </Caption>
    </Button>
  );
}
