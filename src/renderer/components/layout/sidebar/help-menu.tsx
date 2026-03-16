import { Chat, BookOpen, Feed, External } from "@/components/ui/icons";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui";

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
          onClick={() => handleOpenExternal("https://github.com/OkanBilal/jinzo/issues")}
        >
          <Chat className="size-4 shrink-0" />
          <span className="flex-1 text-left">Send feedback</span>
          <External className="size-3 text-primary-400" />
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleOpenExternal("https://docs.usejinzo.com")}
        >
          <BookOpen className="size-4 shrink-0" />
          <span className="flex-1 text-left">Docs</span>
          <External className="size-3 text-primary-400" />
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() =>
            handleOpenExternal(
              "https://usejinzo.com/blog?filter=changelog",
            )
          }
        >
          <Feed className="size-4 shrink-0" />
          <span className="flex-1 text-left">Changelog</span>
          <External className="size-3 text-primary-400" />
        </DropdownMenuItem>
      </div>
    </DropdownMenu>
  );
}
