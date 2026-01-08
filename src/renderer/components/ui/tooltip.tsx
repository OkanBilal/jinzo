"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
  disabled?: boolean;
}

const positionStyles: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowStyles: Record<TooltipPosition, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-primary-800 dark:border-t-primary-950 border-x-transparent border-b-transparent",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-primary-800 dark:border-b-primary-950 border-x-transparent border-t-transparent",
  left: "left-full top-1/2 -translate-y-1/2 border-l-primary-800 dark:border-l-primary-950 border-y-transparent border-r-transparent",
  right: "right-full top-1/2 -translate-y-1/2 border-r-primary-800 dark:border-r-primary-950 border-y-transparent border-l-transparent",
};

export default function Tooltip({
  content,
  children,
  position = "top",
  delay = 100,
  className,
  disabled = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
    
    setTimeout(() => {
      setShouldRender(false);
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {shouldRender && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg pointer-events-none",
            "bg-primary-800 dark:bg-primary-900 text-primary-100 dark:text-primary-200 border border-primary-700 dark:border-primary-800",
            "shadow-lg transition-all duration-100 ease-out",
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95",
            positionStyles[position],
            className
          )}
        >
          {content}
          <span
            className={cn(
              "absolute w-0 h-0 border-4 transition-opacity duration-100",
              isVisible ? "opacity-100" : "opacity-0",
              arrowStyles[position]
            )}
          />
        </div>
      )}
    </div>
  );
}
