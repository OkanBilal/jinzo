import { BookOpen, Feed, External, Bug } from "@/components/ui/icons";
import { Body, DropdownMenu, DropdownMenuItem } from "@/components/ui";

interface HelpMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function HelpMenu({ isOpen, position, onClose }: HelpMenuProps) {
  const adjustedPosition = {
    x: Math.max(8, Math.min(position.x - 60, window.innerWidth - 220)),
    y: Math.max(8, position.y - 115),
  };

  const handleOpenExternal = (url: string) => {
    window.api.shell.openExternal(url);
    onClose();
  };

  return (
    <DropdownMenu
      isOpen={isOpen}
      position={adjustedPosition}
      onClose={onClose}
      minWidth={200}
    >
      <div className="">
        <DropdownMenuItem
          onClick={() => handleOpenExternal("https://github.com/mainsdotdev/mains/issues")}
        >
          <Bug className="size-4 shrink-0" />
          <Body className="flex-1 text-left text-s">Report an Issue</Body>
          <External className="size-3 text-primary-900 dark:text-primary-100" />
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleOpenExternal("https://docs.mains.dev")}
        >
          <BookOpen className="size-4 shrink-0" />
          <Body className="flex-1 text-left text-s">Docs</Body>
          <External className="size-3 text-primary-900 dark:text-primary-100" />
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() =>
            handleOpenExternal(
              "https://mains.dev/blog?filter=changelog",
            )
          }
        >
          <Feed className="size-4 shrink-0" />
          <Body className="flex-1 text-left text-s">Changelog</Body>
          <External className="size-3 text-primary-900 dark:text-primary-100" />
        </DropdownMenuItem>
      </div>
    </DropdownMenu>
  );
}
