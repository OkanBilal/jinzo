import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { isAppReady } from "../../lib/app-ready";

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
}: DropdownWrapperProps) {
  const [coords, setCoords] = useState<{
    top: number | null;
    bottom: number | null;
    left: number;
    width: number;
  } | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const internalDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = externalDropdownRef || internalDropdownRef;

  // Reset enter animation when the menu closes or opens so the double-RAF ramp
  // always starts from prewarm (avoids sync setState in an effect; see react.dev/you-might-not-need-an-effect).
  // Pre-`app-ready` the ramp is skipped entirely: animations are globally
  // forced to 0s and the startup-loaded main thread would starve the two rAFs,
  // holding the menu invisible — latch straight to the (instant) final state.
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen || (isOpen && !prevIsOpen)) {
      setAnimateIn(isOpen && !isAppReady());
    }
  }

  useEffect(() => {
    if (isOpen && usePortal && triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: openUpward ? null : rect.bottom + 8,
        bottom: openUpward ? window.innerHeight - rect.top + 8 : null,
        left: position === "right" ? rect.right : rect.left,
        width: rect.width,
      });
    } else if (!isOpen) {
      setCoords(null);
    }
  }, [isOpen, usePortal, triggerRef, openUpward, position]);

  // Defer animation by two frames so React commit + first paint of children
  // happen before the GPU starts the keyframe — prevents first-open jank.
  // (No-op pre-`app-ready`: the latch above already set animateIn.)
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
        "bg-linear-to-b from-primary/90 to-primary-50/80 dark:from-primary-900 dark:to-primary-800",
        "z-(--z-dropdown) glass-morphism rounded-2xl",
        hiddenClass,
      )}
      style={{
        transformOrigin: openUpward
          ? position === "right"
            ? "bottom right"
            : "bottom left"
          : position === "right"
            ? "top right"
            : "top left",
        ...(usePortal && coords
          ? {
              top: coords.top !== null ? `${coords.top}px` : "auto",
              bottom: coords.bottom !== null ? `${coords.bottom}px` : "auto",
              left: position === "right" ? "auto" : `${coords.left}px`,
              right:
                position === "right"
                  ? `${window.innerWidth - coords.left - coords.width}px`
                  : "auto",
              ...(matchTriggerWidth ? { width: coords.width } : {}),
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
