import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trash, Option, Edit } from "@/components/ui/icons";
import { Muted, Timestamp } from "@/components/ui/text";
import { AnimatedTitle } from "@/components/ui/animated-title";
import {
  ChatSession,
  useUpdateChatSessionTitleMutation,
} from "@/lib/redux/api";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface ChatSessionItemProps {
  session: ChatSession;
  isActive: boolean;
  onDelete: (session: ChatSession, e: React.MouseEvent) => void;
}

export default function ChatSessionItem({
  session,
  isActive,
  onDelete,
}: ChatSessionItemProps) {
  const title = session.title || session.initialQuery || "Untitled Chat";

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [updateTitle] = useUpdateChatSessionTitleMutation();

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleOptionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        x: Math.min(rect.left, window.innerWidth - 150),
        y: rect.bottom + 4,
      });
    }

    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleRenameClick = () => {
    setIsDropdownOpen(false);
    setNewTitle(title);
    setIsRenaming(true);
  };

  const handleRenameSubmit = async () => {
    if (newTitle.trim() && newTitle !== title) {
      try {
        await updateTitle({ sessionId: session.id, title: newTitle.trim() });
      } catch (error) {
        console.error("Failed to rename session:", error);
      }
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setNewTitle(title);
    }
  };

  const handleDeleteClick = () => {
    setIsDropdownOpen(false);
    onDelete(session, undefined as unknown as React.MouseEvent);
  };

  if (isRenaming) {
    return (
      <div className="relative">
        <div
          className={`block pl-3 pr-3 py-1.5 rounded-xl ${
            isActive ? "bg-primary-950/5 dark:bg-primary/5" : "bg-transparent"
          }`}
        >
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            className="w-full text-sm  rounded-lg px-2 py-1 text-primary-900 dark:text-primary-100 focus:outline-none "
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <Link
        to={`/chat/${session.id}`}
        className={`block pl-3 pr-3 py-1.5 active:scale-99 group-hover:scale-[1.01] rounded-xl transition-all duration-200 ease-out  ${
          isActive
            ? "bg-primary/80 dark:bg-primary/5"
            : "bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="line-clamp-1">
            <AnimatedTitle
              title={title}
              className={`text-sm font-medium ${
                isActive
                  ? "text-primary-950 dark:text-primary"
                  : "text-primary-900 dark:text-primary-100"
              }`}
            />
          </div>
          <Muted className="text-[13px] mt-0.5 text-primary-800 dark:text-primary-300 ">
            {formatDate(new Date(session.createdAt).toISOString())}
          </Muted>
        </div>
      </Link>
      <Button
        tooltip="More options"
        ref={buttonRef}
        onClick={handleOptionClick}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100  transition-opacity p-1 cursor-pointer rounded-md z-10"
        aria-label="Chat options"
      >
        <Option className="w-5 h-5 text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200" />
      </Button>

      <DropdownMenu
        isOpen={isDropdownOpen}
        position={dropdownPosition}
        onClose={() => setIsDropdownOpen(false)}
      >
        <DropdownMenuItem onClick={handleRenameClick}>
          <Edit className="size-3.5" />
          <span>Rename</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDeleteClick} variant="danger">
          <Trash className="size-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenu>
    </div>
  );
}
