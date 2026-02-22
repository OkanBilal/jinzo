import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActiveMood } from "@/hooks/use-active-mood";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { getDefaultDropdownBackground } from "@/lib/theme";
import { Button } from "./button";
import { Caption } from "./text";
import { SelectOption } from "./icons";

interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  description?: string;
}

interface SelectProps<T extends string = string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  useFixedBackground?: boolean;
  title?: string;
}

export default function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  useFixedBackground = false,
  title,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  // Keep dropdown position in sync with trigger button via rAF loop
  useEffect(() => {
    if (!isOpen) return;

    let rafId: number;
    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownPosition((prev) => {
          if (
            prev.top === rect.bottom &&
            prev.left === rect.left &&
            prev.width === rect.width
          )
            return prev;
          return { top: rect.bottom, left: rect.left, width: rect.width };
        });
      }
      rafId = requestAnimationFrame(updatePosition);
    };
    rafId = requestAnimationFrame(updatePosition);

    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);
  const { activeMood } = useActiveMood();
  const { darkMode } = useDarkMode();

  // Get background color from active mood theme
  const getDropdownBackground = () => {
    // If using fixed background, return undefined to use CSS class instead
    if (useFixedBackground) {
      return undefined;
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
      return getDefaultDropdownBackground(darkMode, 0.98);
    }

    try {
      const themeConfig = JSON.parse(activeMood.themeConfig);
      const bgColor = darkMode
        ? themeConfig.darkBackground
        : themeConfig.lightBackground;

      if (!bgColor) {
        return getDefaultDropdownBackground(darkMode, 0.98);
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
      return getDefaultDropdownBackground(darkMode, 0.98);
    }
  };

  const fixedBackgroundClass = useFixedBackground
    ? "bg-linear-to-b from-primary to-primary-50 dark:from-primary-900 dark:to-primary-950"
    : "";

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <Button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full pl-3 pr-2.5 py-2.5 
          min-w-50
          bg-primary-950/2 dark:bg-primary/4 
          border border-primary-950/10 dark:border-primary/10
          text-primary-900 dark:text-primary 
          text-sm focus:outline-none cursor-pointer 
          flex items-center justify-between 
          transition-all
          shadow-[inset_0_0.5px_0_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]
          ${
            isOpen
              ? "rounded-t-xl shadow-lg"
              : "rounded-xl hover:bg-primary-950/6 dark:hover:bg-primary/6"
          }
        `}
      >
        <div className="flex items-center gap-2">
          {selectedOption?.icon}
          <span
            className={
              selectedOption ? "" : "text-primary-900 dark:text-primary"
            }
          >
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <Caption
          className="text-primary-900 dark:text-primary-200!  
                absolute right-8 top-1/2 -translate-y-1/2 text-xs"
        >
          {title}
        </Caption>
        <SelectOption
          className={`size-3 text-primary-900 dark:text-primary-400`}
        />
      </Button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`fixed z-9999 
            border border-t-0 border-primary-950/10 dark:border-primary/10 
            rounded-b-xl shadow-lg overflow-hidden
            animate-dropdown-in origin-top ${fixedBackgroundClass}`}
            style={{
              background: getDropdownBackground(),
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            <div className="max-h-60 overflow-auto noscrollbar">
              {options.map((option, index) => (
                <Button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                  w-full cursor-pointer text-left
                  transition-colors px-3 py-2.5
                  text-sm flex items-center gap-2
                  ${
                    value === option.value
                      ? "bg-primary-950/5 dark:bg-primary/8 text-primary-900 dark:text-primary font-medium"
                      : "hover:bg-primary-950/3 dark:hover:bg-primary/5 text-primary-900 dark:text-primary"
                  }
                `}
                >
                  {option.icon}
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-primary-500 dark:text-primary-400 font-normal truncate">
                        {option.description}
                      </span>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
