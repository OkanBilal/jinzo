import { useState, useRef, type MouseEvent } from "react";
import { Muted, Timestamp } from "@/components/ui/text";
import { Trash, Option, Layers } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface WorkspaceItemProps {
  name: string;
  branch?: string | null;
  updatedAt?: Date;
  isActive?: boolean;
  onClick?: () => void;
  onDelete?: (e: MouseEvent) => void;
}

export default function WorkspaceItem({
  name,
  branch,
  updatedAt,
  isActive = false,
  onClick,
  onDelete,
}: WorkspaceItemProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOptionClick = (e: MouseEvent) => {
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

  const handleDeleteClick = () => {
    setIsDropdownOpen(false);
    onDelete?.(undefined as unknown as MouseEvent);
  };

  return (
    <div className="relative group">
      <div
        onClick={onClick}
        className={`block pl-3 pr-3 py-1.5 active:scale-[0.99] group-hover:scale-[1.01] rounded-xl transition-all duration-200 ease-out cursor-pointer ${
          isActive
            ? "bg-primary/80 dark:bg-primary/5"
            : "bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
        }`}
      >
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Layers className="h-4 w-4 text-primary-800 dark:text-primary-400 mt-0.5 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span
              className={`truncate text-sm font-medium ${
                isActive
                  ? "text-primary-900 dark:text-primary"
                  : "text-primary-800 dark:text-primary-100"
              }`}
            >
              {name}
            </span>
            <div className="flex items-center gap-1.5">
              {branch && (
                <Muted className="text-[13px] mt-0.5 text-primary-800 dark:text-primary-300 truncate">
                  {branch}
                </Muted>
              )}
              {branch && updatedAt && (
                <span className="text-primary-400 text-lg leading-6 dark:text-primary-600">·</span>
              )}
              {updatedAt && (
                <Muted className="text-[13px] text-primary-700 dark:text-primary-300 truncate">
                  {formatDate(new Date(updatedAt).toISOString())}
                </Muted>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Options button */}
      <Button
        tooltip="More options"
        ref={buttonRef}
        onClick={handleOptionClick}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer rounded-md z-10"
        aria-label="Workspace options"
      >
        <Option className="w-5 h-5 text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200" />
      </Button>

      {/* Dropdown Menu */}
      <DropdownMenu
        isOpen={isDropdownOpen}
        position={dropdownPosition}
        onClose={() => setIsDropdownOpen(false)}
      >
        <DropdownMenuItem onClick={handleDeleteClick} variant="danger">
          <Trash className="size-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenu>
    </div>
  );
}
