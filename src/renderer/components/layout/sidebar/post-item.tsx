import { useState, useRef, useEffect, type MouseEvent } from "react";
import { Body, Muted } from "@/components/ui/text";
import { Trash, Option, Edit } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AnimatedTitle } from "@/components/ui/animated-title";

interface PostItemProps {
  title: string;
  description: string | null;
  status?: "draft" | "published";
  isActive?: boolean;
  onClick?: () => void;
  onDelete?: (e: MouseEvent) => void;
  onRename?: (newTitle: string) => void;
}

export default function PostItem({
  title,
  description,
  status,
  isActive = false,
  onClick,
  onDelete,
  onRename,
}: PostItemProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleOptionClick = (e: MouseEvent) => {
    e.preventDefault();

    e.stopPropagation();

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        x: Math.min(rect.left + 12, window.innerWidth - 150),
        y: rect.bottom - 2,
      });
    }

    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleRenameClick = () => {
    setIsDropdownOpen(false);
    setNewTitle(title);
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    if (newTitle.trim() && newTitle !== title) {
      onRename?.(newTitle.trim());
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
    onDelete?.(undefined as unknown as MouseEvent);
  };

  if (isRenaming) {
    return (
      <div
        className={`group px-3 py-2 rounded-lg ${
          isActive ? "bg-primary-200/60 dark:bg-primary-700/40" : ""
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleRenameKeyDown}
          className="w-full text-sm font-normal rounded-lg px-2 py-1 text-primary-900 dark:text-primary-100 focus:outline-none "
        />
      </div>
    );
  }

  return (
    <div className="relative group">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
        className={`block px-3 py-2 rounded-xl cursor-pointer group-hover:scale-[1.01] transition-all duration-200 ease-out active:scale-99 ${
          isActive
            ? "bg-primary/80 dark:bg-primary/5"
            : "bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
        }`}
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <Body className="text-primary-950 font-medium dark:text-primary-100! line-clamp-1 leading-snug">
              <AnimatedTitle title={title} />
            </Body>
            {status === "draft" && (
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                Draft
              </span>
            )}
          </div>
          {description && (
            <Muted className="text-[13px] mt-0.5 text-primary-800 dark:text-primary-300! line-clamp-2">
              {description}
            </Muted>
          )}
        </div>
      </div>
      {(onDelete || onRename) && (
        <Button
          tooltip="More options"
          ref={buttonRef}
          onClick={handleOptionClick}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer rounded-md z-10"
          aria-label="Post options"
        >
          <Option className="w-5 h-5 text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200" />
        </Button>
      )}

      <DropdownMenu
        isOpen={isDropdownOpen}
        position={dropdownPosition}
        onClose={() => setIsDropdownOpen(false)}
      >
        {onRename && (
          <DropdownMenuItem onClick={handleRenameClick}>
            <Edit className="size-3.5" />
            <span>Rename</span>
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem onClick={handleDeleteClick} variant="danger">
            <Trash className="size-4" />
            <span>Delete</span>
          </DropdownMenuItem>
        )}
      </DropdownMenu>
    </div>
  );
}
