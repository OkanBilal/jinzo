import { useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface DropdownMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  children: ReactNode;
  minWidth?: number;
  className?: string;
  origin?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "auto";
}

export function DropdownMenu({
  isOpen,
  position,
  onClose,
  children,
  minWidth = 144,
  className = "",
  origin = "auto",
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

  // Calculate transform origin based on position or explicit origin
  const getTransformOrigin = () => {
    if (origin !== "auto") {
      const originMap = {
        "top-left": "top left",
        "top-right": "top right",
        "bottom-left": "bottom left",
        "bottom-right": "bottom right",
      };
      return originMap[origin];
    }

    // Auto-detect based on position relative to viewport
    const isRight = position.x > window.innerWidth / 2;
    const isBottom = position.y > window.innerHeight / 2;

    if (isBottom && isRight) return "bottom right";
    if (isBottom && !isRight) return "bottom left";
    if (!isBottom && isRight) return "top right";
    return "top left";
  };

  return createPortal(
    <div
      ref={menuRef}
      className={`fixed z-100 rounded-xl overflow-hidden glass-morphism animate-dropdown-in ${className}`}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        minWidth,
        transformOrigin: getTransformOrigin(),
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
  disabled?: boolean;
}

export function DropdownMenuItem({
  onClick,
  children,
  variant = "default",
  className = "",
  disabled = false,
}: DropdownMenuItemProps) {
  const variantClasses = {
    default: "text-primary-800 dark:text-primary-100 hover:text-primary-900 dark:hover:text-primary-50",
    danger: "text-[#f44336] dark:text-[#f44336] ",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-sm
        hover:bg-primary-100/50 dark:hover:bg-primary/5 transition-colors
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
