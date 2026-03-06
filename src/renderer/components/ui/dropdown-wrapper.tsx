import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActiveSpace } from "@/hooks/use-active-space";
import { useDarkMode } from "@/hooks/use-dark-mode";
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

  const { activeSpace } = useActiveSpace();
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

  // Cache background — avoid DOM queries on every render
  const dropdownBackground = useMemo(() => {
    if (useFixedBackground) return undefined;

    if (!activeSpace?.themeConfig) {
      return getDefaultDropdownBackground(darkMode);
    }

    try {
      const themeConfig = JSON.parse(activeSpace.themeConfig);
      const bgColor = darkMode
        ? themeConfig.darkBackground
        : themeConfig.lightBackground;

      if (!bgColor) {
        return getDefaultDropdownBackground(darkMode);
      }

      if (bgColor.startsWith("linear-gradient")) {
        return bgColor;
      } else {
        return bgColor.length === 9 ? bgColor.slice(0, 7) : bgColor;
      }
    } catch {
      return getDefaultDropdownBackground(darkMode);
    }
  }, [useFixedBackground, activeSpace?.themeConfig, darkMode]);

  const fixedBackgroundClass = useFixedBackground
    ? "bg-linear-to-b from-primary/90 to-primary-50/80 dark:from-primary-900/95 dark:to-primary-900/80"
    : "";

  // Portal mode: wait for coords before rendering
  if (usePortal && isOpen && !coords) return null;

  const positionClass = position === "right" ? "right-0" : "left-0";
  const verticalClass = openUpward ? "bottom-10" : "top-8";

  const hiddenClass = isOpen ? "animate-dropdown-in" : "invisible pointer-events-none";

  const dropdown = (
    <div
      ref={dropdownRef}
      className={`${usePortal ? "fixed" : "absolute"} ${!usePortal ? positionClass : ""} ${!usePortal ? verticalClass : ""}
        ${minWidth} ${fixedBackgroundClass} z-100 glass-morphism rounded-2xl ${hiddenClass}`}
      style={{
        background: dropdownBackground,
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
    return isOpen ? createPortal(dropdown, document.body) : null;
  }

  return dropdown;
}
