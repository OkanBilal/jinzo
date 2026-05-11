import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { useDropdownBackground } from "@/hooks/use-dropdown-background";

interface DropdownWrapperProps {
  isOpen: boolean;
  children: ReactNode;
  openUpward?: boolean;
  minWidth?: string;
  position?: "left" | "right";
  usePortal?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  /** When portal + anchored: set false so panel can grow beyond trigger width (e.g. menus with min-width). */
  matchTriggerWidth?: boolean;
  useFixedBackground?: boolean;
}

export default function DropdownWrapper({
  isOpen,
  children,
  openUpward = false,
  minWidth = "min-w-(--dropdown-min-width)",
  position = "left",
  usePortal = false,
  triggerRef,
  dropdownRef: externalDropdownRef,
  matchTriggerWidth = true,
  useFixedBackground = false,
}: DropdownWrapperProps) {
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const internalDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = externalDropdownRef || internalDropdownRef;

  // Reset enter animation when the menu closes or opens so the double-RAF ramp
  // always starts from prewarm (avoids sync setState in an effect; see react.dev/you-might-not-need-an-effect).
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen || (isOpen && !prevIsOpen)) {
      setAnimateIn(false);
    }
  }

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

  // Defer animation by two frames so React commit + first paint of children
  // happen before the GPU starts the keyframe — prevents first-open jank.
  useEffect(() => {
    if (!isOpen) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setAnimateIn(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [isOpen]);

  const dropdownBackground = useDropdownBackground(undefined, useFixedBackground);

  const fixedBackgroundClass = useFixedBackground
    ? "bg-linear-to-b from-primary/90 to-primary-50/80 dark:from-primary-900 dark:to-primary-800"
    : "";

  // Portal mode: wait for coords before rendering
  if (usePortal && isOpen && !coords) return null;

  const positionClass = position === "right" ? "right-0" : "left-0";
  const verticalClass = openUpward ? "bottom-10" : "top-8";

  const hiddenClass = isOpen && animateIn ? "animate-dropdown-in" : "dropdown-prewarm";

  const dropdown = (
    <div
      ref={dropdownRef}
      className={cn(
        usePortal ? "fixed" : "absolute",
        !usePortal && positionClass,
        !usePortal && verticalClass,
        minWidth,
        fixedBackgroundClass,
        "z-(--z-dropdown) glass-morphism rounded-2xl",
        hiddenClass,
      )}
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
              ...(matchTriggerWidth ? { width: coords.width } : {}),
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
