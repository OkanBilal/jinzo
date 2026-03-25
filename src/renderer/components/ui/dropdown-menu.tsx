import { useRef, useEffect, useState, useCallback, createContext, useContext, ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { ArrowUp, Selected } from "./icons";

// Context to let parent DropdownMenu know about submenu portals
const DropdownContext = createContext<{
  registerSubmenu: (el: HTMLElement) => void;
  unregisterSubmenu: (el: HTMLElement) => void;
}>({
  registerSubmenu: () => {},
  unregisterSubmenu: () => {},
});

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
  const submenuRefs = useRef<Set<HTMLElement>>(new Set());

  const registerSubmenu = useCallback((el: HTMLElement) => {
    submenuRefs.current.add(el);
  }, []);

  const unregisterSubmenu = useCallback((el: HTMLElement) => {
    submenuRefs.current.delete(el);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      for (const sub of submenuRefs.current) {
        if (sub.contains(target)) return;
      }
      onClose();
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
    y: Math.max(8, Math.min(position.y, window.innerHeight - 125)),
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
    <DropdownContext.Provider value={{ registerSubmenu, unregisterSubmenu }}>
      <div
        ref={menuRef}
        className={cn(
          "fixed z-(--z-dropdown) rounded-2xl overflow-hidden glass-morphism animate-dropdown-in",
          className,
        )}
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
          minWidth,
          transformOrigin: getTransformOrigin(),
        }}
      >
        {children}
      </div>
    </DropdownContext.Provider>,
    document.body,
  );
}

interface DropdownMenuSubProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DropdownMenuSub({
  label,
  children,
  className = "",
}: DropdownMenuSubProps) {
  const { registerSubmenu, unregisterSubmenu } = useContext(DropdownContext);
  const triggerRef = useRef<HTMLDivElement>(null);
  const submenuElRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submenuRefCallback = useCallback((el: HTMLDivElement | null) => {
    if (submenuElRef.current) {
      unregisterSubmenu(submenuElRef.current);
    }
    submenuElRef.current = el;
    if (el) {
      registerSubmenu(el);
    }
  }, [registerSubmenu, unregisterSubmenu]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const startCloseTimer = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setIsOpen(false), 150);
  }, [clearCloseTimer]);

  const [submenuPos, setSubmenuPos] = useState({ top: 0, left: 0 });

  const handleTriggerEnter = () => {
    clearCloseTimer();
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setSubmenuPos({ top: rect.top, left: rect.right + 4 });
    }
    setIsOpen(true);
  };

  const handleTriggerLeave = () => {
    startCloseTimer();
  };

  const handleSubmenuEnter = () => {
    clearCloseTimer();
  };

  const handleSubmenuLeave = () => {
    startCloseTimer();
  };

  useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.75 text-s cursor-pointer",
          "text-primary-800 dark:text-primary-100 hover:text-primary-900 dark:hover:text-primary-50",
          "hover:bg-primary-100/80 dark:hover:bg-primary/5 transition-colors",
          className,
        )}
      >
        {label}
        <ArrowUp className="rotate-90 size-3 ml-auto"/>
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={submenuRefCallback}
            onMouseEnter={handleSubmenuEnter}
            onMouseLeave={handleSubmenuLeave}
            className="fixed z-(--z-dropdown-sub) rounded-2xl overflow-hidden glass-morphism animate-dropdown-sub-in"
            style={{
              top: submenuPos.top,
              left: submenuPos.left,
              minWidth: 180,
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

interface DropdownMenuItemProps {
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "danger";
  className?: string;
  disabled?: boolean;
  selected?: boolean;
}

export function DropdownMenuItem({
  onClick,
  children,
  variant = "default",
  className = "",
  disabled = false,
  selected,
}: DropdownMenuItemProps) {
  const variantClasses = {
    default: "text-primary-800 dark:text-primary-100 hover:text-primary-900 dark:hover:text-primary-50",
    danger: "text-danger dark:text-danger",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.75 text-s",
        "hover:bg-primary-100/80 dark:hover:bg-primary/5 transition-colors",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        variantClasses[variant],
        className,
      )}
    >
      {selected !== undefined && (
        <Selected className={`" size-3 " ${selected ? "opacity-100": "opacity-0"} `} />

      )}
      {children}
    </button>
  );
}
