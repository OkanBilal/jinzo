import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActiveMood } from "@/hooks/use-active-mood";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useWorkspaceVariant } from "@/hooks/use-workspace-variant";
import { getDefaultDropdownBackground } from "@/lib/theme";

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
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const internalDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = externalDropdownRef || internalDropdownRef;

  // Call hooks before any conditional returns
  const { activeMood } = useActiveMood();
  const { darkMode } = useDarkMode();
  const variant = useWorkspaceVariant();

  const glassMorphismClass =
    variant === "claude"
      ? "glass-morphism-claude"
      : variant === "copilot"
        ? "glass-morphism-copilot"
        : "glass-morphism";

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
    const appRoot = document.querySelector(".app-root") as HTMLElement;
    const previewBg = appRoot
      ? getComputedStyle(appRoot).getPropertyValue("--mood-preview-bg").trim()
      : "";
    if (previewBg) {
      return previewBg;
    }

    if (!activeMood?.themeConfig) {
      return getDefaultDropdownBackground(darkMode);
    }

    try {
      const themeConfig = JSON.parse(activeMood.themeConfig);
      const bgColor = darkMode
        ? themeConfig.darkBackground
        : themeConfig.lightBackground;

      if (!bgColor) {
        return getDefaultDropdownBackground(darkMode);
      }

      // For gradients, return as is; for solid colors, remove opacity to prevent transparency
      if (bgColor.startsWith("linear-gradient")) {
        return bgColor;
      } else {
        // Remove opacity suffix if present (e.g., #RRGGBBAA -> #RRGGBB)
        return bgColor.length === 9 ? bgColor.slice(0, 7) : bgColor;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return getDefaultDropdownBackground(darkMode);
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
  const verticalClass = openUpward ? "bottom-10" : "top-8";

  const dropdown = (
    <div
      ref={dropdownRef}
      className={`${usePortal ? "fixed" : "absolute"} ${!usePortal ? positionClass : ""} ${!usePortal ? verticalClass : ""} 
        ${minWidth} ${fixedBackgroundClass} z-100 ${glassMorphismClass} rounded-2xl transition-all animate-dropdown-in`}
      style={{
        background: getDropdownBackground(),
        transformOrigin: openUpward
          ? position === "right"
            ? "bottom right"
            : "bottom left"
          : position === "right"
            ? "top right"
            : "top left",
        ...(usePortal && coords
          ? {
              top: `${coords.top}px`,
              left: position === "right" ? "auto" : `${coords.left}px`,
              right:
                position === "right"
                  ? `${window.innerWidth - coords.left - coords.width}px`
                  : "auto",
              width: coords.width,
              transform: openUpward ? "translateY(-100%)" : "none",
            }
          : {}),
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
