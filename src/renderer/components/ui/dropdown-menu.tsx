import { useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface DropdownMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  children: ReactNode;
  minWidth?: number;
  className?: string;
}

export function DropdownMenu({
  isOpen,
  position,
  onClose,
  children,
  minWidth = 144,
  className = "",
}: DropdownMenuProps) {
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

  // Adjust position to keep menu on screen
  const adjustedPosition = {
    x: Math.max(8, Math.min(position.x, window.innerWidth - minWidth - 8)),
    y: Math.max(8, Math.min(position.y, window.innerHeight - 100)),
  };

  return createPortal(
    <div
      ref={menuRef}
      className={`fixed z-100 rounded-xl overflow-hidden glass-morphism ${className}`}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        minWidth,
        animation: "scaleIn 100ms ease-out",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

interface DropdownMenuItemProps {
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "danger";
  className?: string;
}

export function DropdownMenuItem({
  onClick,
  children,
  variant = "default",
  className = "",
}: DropdownMenuItemProps) {
  const variantClasses = {
    default: "text-primary-700 dark:text-primary-200",
    danger: "text-red-600 dark:text-red-400",
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-sm
        hover:bg-primary-100/50 dark:hover:bg-primary/10 transition-colors cursor-pointer
        ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
