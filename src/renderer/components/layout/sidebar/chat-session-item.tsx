import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { Trash, Option, Edit } from "@/components/ui/icons";
import { Timestamp } from "@/components/ui/text";
import { AnimatedTitle } from "@/components/ui/animated-title";
import {
  ChatSession,
  useUpdateChatSessionTitleMutation,
} from "@/lib/redux/api";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";

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

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [updateTitle] = useUpdateChatSessionTitleMutation();

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isDropdownOpen]);

  // Focus input when renaming starts
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
          className={`block pl-3 pr-3 py-2 rounded-xl ${
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
            className="w-full text-sm font-normal  rounded-lg px-2 py-1 text-primary-900 dark:text-primary-100 focus:outline-none "
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <Link
        to={`/chat/${session.id}`}
        className={`block pl-3 pr-3 py-1.5 group-hover:scale-[1.01] rounded-xl transition-all duration-200 ease-out  active:scale-[0.99] ${
          isActive
            ? "bg-primary-950/5 dark:bg-primary/5"
            : "bg-transparent hover:bg-primary-950/3 dark:hover:bg-primary/5"
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="line-clamp-1">
            <AnimatedTitle
              title={title}
              className={`text-sm font-medium ${
                isActive
                  ? "text-primary-900 dark:text-primary"
                  : "text-primary-800 dark:text-primary-100"
              }`}
            />
          </div>
          <Timestamp className="">
            {formatDate(new Date(session.createdAt).toISOString())}
          </Timestamp>
        </div>
      </Link>
      <Button
        tooltip="More options"
        ref={buttonRef}
        onClick={handleOptionClick}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100  transition-opacity p-1 cursor-pointer rounded-md z-10"
        aria-label="Chat options"
      >
        <Option className="w-5 h-5 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200" />
      </Button>

      {/* Dropdown Menu */}
      {isDropdownOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-100 min-w-36 rounded-xl overflow-hidden glass-morphism"
            style={{
              left: dropdownPosition.x,
              top: dropdownPosition.y,
              animation: "scaleIn 100ms ease-out",
            }}
          >
            <Button
              onClick={handleRenameClick}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary-700 dark:text-primary-200
                hover:bg-primary-100/50 dark:hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <Edit className="size-4" />
              <span>Rename</span>
            </Button>
            <Button
              onClick={handleDeleteClick}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400
                hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
            >
              <Trash className="size-4" />
              <span>Delete</span>
            </Button>
          </div>,
          document.body,
        )}
    </div>
  );
}
