import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActiveMood } from "@/hooks/useActiveMood";
import { useDarkMode } from "@/hooks/useDarkMode";

interface DropdownWrapperProps {
  isOpen: boolean;
  children: ReactNode;
  openUpward?: boolean;
  minWidth?: string;
  position?: "left" | "right";
  usePortal?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  useFixedBackground?: boolean;
}

export default function DropdownWrapper({
  isOpen,
  children,
  openUpward = false,
  minWidth = "min-w-[140px]",
  position = "left",
  usePortal = false,
  triggerRef,
  dropdownRef: externalDropdownRef,
  useFixedBackground = false,
}: DropdownWrapperProps) {
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const internalDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = externalDropdownRef || internalDropdownRef;

  // Call hooks before any conditional returns
  const { activeMood } = useActiveMood();
  const { darkMode } = useDarkMode();

  useEffect(() => {
    if (isOpen && usePortal && triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: openUpward ? rect.top - 8 : rect.bottom + 8,
        left: position === "right" ? rect.right : rect.left,
        width: rect.width,
      });
    } else if (!isOpen) {
      setCoords(null);
    }
  }, [isOpen, usePortal, triggerRef, openUpward, position]);

  // Get background color from active mood theme
  const getDropdownBackground = () => {
    // If using fixed background, return the glassmorphism gradient matching the chat input
    if (useFixedBackground) {
      return undefined; // Will use CSS class instead
    }

    // First check if we're in preview mode (create mood view)
    const appRoot = document.querySelector('.app-root') as HTMLElement;
    const previewBg = appRoot ? getComputedStyle(appRoot).getPropertyValue('--mood-preview-bg').trim() : '';
    if (previewBg) {
      return previewBg;
    }

    if (!activeMood?.themeConfig) {
      return darkMode ? 'rgb(17 24 39 / 0.95)' : 'rgb(255 255 255 / 0.95)';
    }

    try {
      const themeConfig = JSON.parse(activeMood.themeConfig);
      const bgColor = darkMode ? themeConfig.darkBackground : themeConfig.lightBackground;

      if (!bgColor) {
        return darkMode ? 'rgb(17 24 39 / 0.95)' : 'rgb(255 255 255 / 0.95)';
      }

      // For gradients, return as is; for solid colors, remove opacity to prevent transparency
      if (bgColor.startsWith('linear-gradient')) {
        return bgColor;
      } else {
        // Remove opacity suffix if present (e.g., #RRGGBBAA -> #RRGGBB)
        return bgColor.length === 9 ? bgColor.slice(0, 7) : bgColor;
      }
    } catch (e) {
      return darkMode ? 'rgb(17 24 39 / 0.95)' : 'rgb(255 255 255 / 0.95)';
    }
  };

  // Fixed background class matching chat input style
  const fixedBackgroundClass = useFixedBackground
    ? "bg-linear-to-b from-white/90 to-primary-50/80 dark:from-primary-900/95 dark:to-primary-900/80"
    : "";

  if (!isOpen) return null;
  
  // Portal kullanıyorsa koordinatlar hesaplanana kadar render etme
  if (usePortal && !coords) return null;

  if (!isOpen) return null;
  
  // Portal kullanıyorsa koordinatlar hesaplanana kadar render etme
  if (usePortal && !coords) return null;

  const positionClass = position === "right" ? "right-0" : "left-0";
  const verticalClass = openUpward ? "bottom-12" : "top-8";

  const originClass = openUpward
    ? position === "right"
      ? "origin-bottom-right"
      : "origin-bottom-left"
    : position === "right"
      ? "origin-top-right"
      : "origin-top-left";

  const dropdown = (
    <div
      ref={dropdownRef}
      className={`${usePortal ? "fixed" : "absolute"} ${!usePortal ? positionClass : ""} ${!usePortal ? verticalClass : ""} ${minWidth} ${originClass} ${fixedBackgroundClass} z-100 glass-morphism rounded-xl transition-all`}
      style={{
        background: getDropdownBackground(),
        ...(usePortal && coords ? {
          animation: "scaleIn 150ms ease-out",
          top: `${coords.top}px`,
          left: position === "right" ? "auto" : `${coords.left}px`,
          right: position === "right" ? `${window.innerWidth - coords.left - coords.width}px` : "auto",
          width: coords.width,
          transform: openUpward ? "translateY(-100%)" : "none",
        } : {
          animation: "scaleIn 150ms ease-out",
        }),
      }}
      role="menu"
    >
      {children}
    </div>
  );

  if (usePortal) {
    return createPortal(dropdown, document.body);
  }

  return dropdown;
}
