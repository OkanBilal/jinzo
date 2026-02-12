import { useEffect } from "react";
import { Edit, Plus } from "@/components/ui/icons";
import { Body, Caption } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface NewButtonProps {
  onClick: () => void;
  title: string;
  actionPrefix?: string;
  icon?: React.ReactNode;
}

export default function NewButton({ onClick, title, icon, actionPrefix = "New" }: NewButtonProps) {
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
      className="justify-start cursor-pointer p-4 hover:scale-101 transition-transform duration-200 "
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {icon}
      <Body className="text-primary-900 dark:text-primary-100 font-medium">
        {actionPrefix} {title}
      </Body>
      <Caption className="ml-auto text-primary-900 dark:text-primary-100!">
        ⌘ N
      </Caption>
    </Button>
  );
}
