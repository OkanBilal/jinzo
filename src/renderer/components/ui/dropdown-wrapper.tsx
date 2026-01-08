import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DropdownWrapperProps {
  isOpen: boolean;
  children: ReactNode;
  openUpward?: boolean;
  minWidth?: string;
  position?: "left" | "right";
  usePortal?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
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
}: DropdownWrapperProps) {
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const internalDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = externalDropdownRef || internalDropdownRef;

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
      className={`${usePortal ? "fixed" : "absolute"} ${!usePortal ? positionClass : ""} ${!usePortal ? verticalClass : ""} ${minWidth} ${originClass} z-100 bg-primary-50/20 dark:bg-primary-900/20 border border-primary-200/50 dark:border-primary-900 rounded-xl backdrop-blur-xl transition-all`}
      style={
        usePortal && coords
          ? {
              animation: "scaleIn 150ms ease-out",
              top: `${coords.top}px`,
              left: position === "right" ? "auto" : `${coords.left}px`,
              right: position === "right" ? `${window.innerWidth - coords.left - coords.width}px` : "auto",
              width: coords.width,
              transform: openUpward ? "translateY(-100%)" : "none",
            }
          : {
              animation: "scaleIn 150ms ease-out",
            }
      }
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
