import { useRef, useEffect, useState, useCallback, createContext, useContext, ReactNode } from "react";
import { createPortal } from "react-dom";

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
    x: Math.max(8, Math.min(position.x, window.innerWidth - minWidth - 1300 )),
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
        className={`fixed z-100 rounded-2xl overflow-hidden glass-morphism-button animate-dropdown-in ${className}`}
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

  const handleTriggerEnter = () => {
    clearCloseTimer();
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

  const getSubmenuPosition = () => {
    if (!triggerRef.current) return { top: 0, left: 0 };
    const rect = triggerRef.current.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.right + 4,
    };
  };

  const pos = getSubmenuPosition();

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-s cursor-pointer
          text-primary-800 dark:text-primary-100 hover:text-primary-900 dark:hover:text-primary-50
          hover:bg-primary-100/50 dark:hover:bg-primary/5 transition-colors ${className}`}
      >
        {label}
        <span className="ml-auto text-primary-500 dark:text-primary-400 text-xs">›</span>
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={submenuRefCallback}
            onMouseEnter={handleSubmenuEnter}
            onMouseLeave={handleSubmenuLeave}
            className="fixed z-101 rounded-2xl overflow-hidden glass-morphism-button animate-dropdown-sub-in"
            style={{
              top: pos.top,
              left: pos.left,
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
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-s
        hover:bg-primary-100/50 dark:hover:bg-primary/5 transition-colors
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
