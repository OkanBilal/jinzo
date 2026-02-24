import { useState } from "react";
import { Chat, BookOpen, Feed, External } from "@/components/ui/icons";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import FeedbackModal from "./feedback-modal";

interface HelpMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function HelpMenu({ isOpen, position, onClose }: HelpMenuProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const adjustedPosition = {
    x: Math.max(8, Math.min(position.x - 60, window.innerWidth - 220)),
    y: Math.max(8, position.y - 135),
  };

  const handleOpenExternal = (url: string) => {
    window.api.shell.openExternal(url);
    onClose();
  };

  const handleFeedback = () => {
    onClose();
    setFeedbackOpen(true);
  };

  return (
    <>
      <DropdownMenu
        isOpen={isOpen}
        position={adjustedPosition}
        onClose={onClose}
        minWidth={200}
      >
        <div className="">
          <DropdownMenuItem onClick={handleFeedback}>
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
                "https://github.com/okanbilal/jinzo/releases",
              )
            }
          >
            <Feed className="size-4 shrink-0" />
            <span className="flex-1 text-left">Changelog</span>
            <External className="size-3 text-primary-400" />
          </DropdownMenuItem>
        </div>
      </DropdownMenu>

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </>
  );
}
