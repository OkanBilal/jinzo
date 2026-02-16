import { Chat, BookOpen, Feed, External } from "@/components/ui/icons";
import { Star } from "@/components/ui/icons/mood";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface HelpMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function HelpMenu({ isOpen, position, onClose }: HelpMenuProps) {
  const adjustedPosition = {
    x: Math.max(8, Math.min(position.x - 60, window.innerWidth - 220)),
    y: Math.max(8, position.y - 135),
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
          onClick={() =>
            handleOpenExternal(
              "https://github.com/nicholasgriffintn/jinzo/issues/new",
            )
          }
        >
          <Chat className="size-4 shrink-0" />
          <span className="flex-1 text-left">Send feedback</span>
          <span className="text-xs text-primary-500 dark:text-primary-400">
            ⌘⇧F
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleOpenExternal("https://jinzo.dev/docs")}
        >
          <BookOpen className="size-4 shrink-0" />
          <span className="flex-1 text-left">Docs</span>
          <External className="size-3 text-primary-400" />
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() =>
            handleOpenExternal(
              "https://github.com/nicholasgriffintn/jinzo/releases",
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
