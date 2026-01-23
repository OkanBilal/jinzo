import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Edit, Trash } from "@/components/ui/icons";
import type { Mood } from "@/lib/redux/api";
import { Button } from "@/components/ui/button";

interface MoodContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  mood: Mood | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function MoodContextMenu({
  isOpen,
  position,
  mood,
  onEdit,
  onDelete,
  onClose,
}: MoodContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mood) return null;

  // Adjust position to keep menu on screen
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 160),
    y: Math.min(position.y, window.innerHeight - 100),
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-100 min-w-36 rounded-xl overflow-hidden glass-morphism"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        animation: "scaleIn 100ms ease-out",
      }}
    >
      <Button
        onClick={() => {
          onEdit();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary-700 dark:text-primary-200
          hover:bg-primary-100/50 dark:hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <Edit className="size-4" />
        <span>Edit</span>
      </Button>
      <Button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400
          hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
      >
        <Trash className="size-4" />
        <span>Delete</span>
      </Button>
    </div>,
    document.body
  );
}
