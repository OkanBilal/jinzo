import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActiveMood } from "@/hooks/useActiveMood";
import { useDarkMode } from "@/hooks/useDarkMode";
import { getDefaultDropdownBackground } from "@/lib/theme";
import { Button } from "./button";

interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SelectProps<T extends string = string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  useFixedBackground?: boolean;
}

export default function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  useFixedBackground = false,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside (using portal, need to check both refs)
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
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    const appRoot = document.querySelector('.app-root') as HTMLElement;
    const previewBg = appRoot ? getComputedStyle(appRoot).getPropertyValue('--mood-preview-bg').trim() : '';
    if (previewBg) {
      return previewBg;
    }
    
    if (!activeMood?.themeConfig) {
      return getDefaultDropdownBackground(darkMode, 0.98);
    }
    
    try {
      const themeConfig = JSON.parse(activeMood.themeConfig);
      const bgColor = darkMode ? themeConfig.darkBackground : themeConfig.lightBackground;
      
      if (!bgColor) {
        return getDefaultDropdownBackground(darkMode, 0.98);
      }
      
      // For gradients, return as is; for solid colors, remove opacity to prevent transparency
      if (bgColor.startsWith('linear-gradient')) {
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

  // Fixed background class matching dropdown wrapper style
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
          w-full px-3 py-2.5 
          min-w-50
          bg-primary-950/2 dark:bg-primary/4 
          border border-primary-950/10 dark:border-primary/10
          text-primary-800 dark:text-primary-200 
          text-sm focus:outline-none cursor-pointer 
          flex items-center justify-between 
          transition-all
          shadow-[inset_0_0.5px_0_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]
          ${
            isOpen
              ? "rounded-t-xl shadow-lg"
              : "rounded-xl hover:bg-primary-950/4 dark:hover:bg-primary/6"
          }
        `}
      >
        <div className="flex items-center gap-2">
          {selectedOption?.icon}
          <span
            className={
              selectedOption ? "" : "text-primary-500 dark:text-primary-400"
            }
          >
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </Button>

      {/* Options List - Portal rendered to body */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className={`fixed z-9999 
            border border-t-0 border-primary-950/10 dark:border-primary/10 
            rounded-b-xl shadow-lg overflow-hidden
            animate-slideDown ${fixedBackgroundClass}`}
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
                style={{
                  animation: `slideIn 0.20s ease-out ${index * 0.025}s both`,
                }}
                className={`
                  w-full cursor-pointer text-left 
                  transition-colors px-3 py-2.5 
                  text-sm flex items-center gap-2
                  ${
                    value === option.value
                      ? "bg-primary-950/5 dark:bg-primary/8 text-primary-900 dark:text-primary-100 font-medium"
                      : "hover:bg-primary-950/3 dark:hover:bg-primary/5 text-primary-700 dark:text-primary-200"
                  }
                `}
              >
                {option.icon}
                <span className="truncate">{option.label}</span>
              </Button>
            ))}
          </div>
        </div>,
        document.body
      )}
      <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-5px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
    </div>
  );
}
