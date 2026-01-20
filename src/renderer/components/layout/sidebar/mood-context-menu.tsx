import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash } from "@/components/ui/icons";
import type { Mood } from "@/lib/redux/api";

interface MoodContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  mood: Mood | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        fill="currentColor"
        d="M16.293 2.293a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1 0 1.414l-13 13A1 1 0 0 1 8 21H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 .293-.707l13-13ZM14 5.414 5 14.414V19h4.586l9-9L14 5.414Zm4 1.172 2.586-2.586-2.586-2.586L15.414 4 18 6.586Z"
      />
    </svg>
  );
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
      className="fixed z-100 min-w-36 py-1.5 rounded-xl overflow-hidden
        bg-linear-to-b from-white/90 to-primary-50/80 dark:from-primary-900/95 dark:to-primary-900/80
        backdrop-blur-xl saturate-180 border border-white/40 dark:border-white/10
        shadow-[0_4px_16px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]
        dark:shadow-[0_4px_16px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        animation: "scaleIn 100ms ease-out",
      }}
    >
      <button
        onClick={() => {
          onEdit();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-primary-700 dark:text-primary-200
          hover:bg-primary-100/50 dark:hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <PencilIcon className="size-4" />
        <span>Edit</span>
      </button>
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400
          hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
      >
        <Trash className="size-4" />
        <span>Delete</span>
      </button>
    </div>,
    document.body
  );
}
