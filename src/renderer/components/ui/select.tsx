import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActiveSpace } from "@/hooks/use-active-space";
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

  // Calculate dropdown position once when opened
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom, left: rect.left, width: rect.width });
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
  const { activeSpace } = useActiveSpace();
  const { darkMode } = useDarkMode();

  // Cache background computation — avoid DOM queries on every render
  const dropdownBackground = useMemo(() => {
    if (useFixedBackground) return undefined;

    if (!activeSpace?.themeConfig) {
      return getDefaultDropdownBackground(darkMode, 0.98);
    }

    try {
      const themeConfig = JSON.parse(activeSpace.themeConfig);
      const bgColor = darkMode
        ? themeConfig.darkBackground
        : themeConfig.lightBackground;

      if (!bgColor) {
        return getDefaultDropdownBackground(darkMode, 0.98);
      }

      if (bgColor.startsWith("linear-gradient")) {
        return bgColor;
      } else {
        return bgColor.length === 9 ? bgColor.slice(0, 7) : bgColor;
      }
    } catch (e) {
      console.error("Error parsing themeConfig:", e);
      return getDefaultDropdownBackground(darkMode, 0.98);
    }
  }, [useFixedBackground, activeSpace?.themeConfig, darkMode]);

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
          border border-primary-950/10 dark:border-primary/5
          text-primary-900 dark:text-primary
          text-sm focus:outline-none cursor-pointer
          flex items-center justify-between
          transition-colors
          shadow-(--shadow-inset-subtle) dark:shadow-(--shadow-inset-subtle-dark)
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

      {createPortal(
        <div
          ref={dropdownRef}
          className={`fixed z-(--z-modal)
            border border-t-0 border-primary-950/10 dark:border-primary/10
            rounded-b-xl shadow-lg overflow-hidden
            ${isOpen ? "animate-dropdown-in" : "pointer-events-none invisible will-change-[transform,opacity]"}
            origin-top ${fixedBackgroundClass}`}
          style={{
            background: dropdownBackground,
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          <div className="max-h-60 overflow-auto noscrollbar">
            {options.map((option) => (
              <Button
                type="button"
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full cursor-pointer text-left
                  transition-colors px-3 py-2
                  text-sm flex items-center gap-2
                  ${
                    value === option.value
                      ? "bg-primary-950/5 dark:bg-primary/8 text-primary-900 dark:text-primary "
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
