import { useState, useRef, useEffect, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Body, Muted } from "@/components/ui/text";
import { Trash, Option, Edit } from "@/components/ui/icons";

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
  const [newTitle, setNewTitle] = useState(title);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: globalThis.MouseEvent) => {
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

  // Update newTitle when title prop changes
  useEffect(() => {
    setNewTitle(title);
  }, [title]);

  const handleOptionClick = (e: MouseEvent) => {
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

  // Rename mode UI
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
          className="w-full text-sm font-normal  rounded-lg px-2 py-1 text-primary-900 dark:text-primary-100 focus:outline-none "
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`group px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "bg-primary-200/60 dark:bg-primary-700/40"
          : "hover:bg-primary-100/50 dark:hover:bg-primary-800/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Body className=" text-primary-900 dark:text-primary-100 line-clamp-1 leading-snug">
              {title}
            </Body>
            {status === "draft" && (
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                Draft
              </span>
            )}
          </div>
          {description && (
            <Muted className="mt-1 line-clamp-2 text-xs leading-relaxed">
              {description}
            </Muted>
          )}
        </div>
        {(onDelete || onRename) && (
          <button
            ref={buttonRef}
            onClick={handleOptionClick}
            className="shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
            aria-label="Post options"
          >
            <Option className="w-5 h-5 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200" />
          </button>
        )}
      </div>

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
            {onRename && (
              <button
                onClick={handleRenameClick}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary-700 dark:text-primary-200
                  hover:bg-primary-100/50 dark:hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Edit className="size-4" />
                <span>Rename</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDeleteClick}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400
                  hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
              >
                <Trash className="size-4" />
                <span>Delete</span>
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
