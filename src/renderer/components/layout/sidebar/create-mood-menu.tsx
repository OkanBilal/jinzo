import { Plus, Preset } from "@/components/ui/icons";
import { Bolt } from "@/components/ui/icons/mood";
import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface CreateMoodMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onCreateMood: () => void;
  onPresetMoods: () => void;
  onClose: () => void;
}

export default function CreateMoodMenu({
  isOpen,
  position,
  onCreateMood,
  onPresetMoods,
  onClose,
}: CreateMoodMenuProps) {
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

  if (!isOpen) return null;

  // Position menu above the button
  const adjustedPosition = {
    x: Math.max(8, Math.min(position.x - 70, window.innerWidth - 160)),
    y: Math.max(8, position.y - 90),
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-100 min-w-40 rounded-xl overflow-hidden glass-morphism"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        animation: "scaleIn 100ms ease-out",
      }}
    >
      <button
        onClick={() => {
          onCreateMood();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary-700 dark:text-primary-100
          hover:bg-primary-100/50 dark:hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <Bolt className="size-4" />
        <span>Create Mood</span>
      </button>
      <button
        onClick={() => {
          onPresetMoods();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary-700 dark:text-primary-100
          hover:bg-primary-100/50 dark:hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <Preset className="size-4" />
        <span>Preset Moods</span>
      </button>
    </div>,
    document.body,
  );
}
