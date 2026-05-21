import {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useClickOutside } from "@/hooks/use-click-outside";
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
  title?: string;
}

export default function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  title,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  // Reset enter animation when the menu closes or opens so the double-RAF ramp
  // always starts from prewarm (avoids sync setState in an effect).
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen || (isOpen && !prevIsOpen)) {
      setAnimateIn(false);
    }
  }

  const updateDropdownPosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom, left: rect.left, width: rect.width });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let frameId = 0;
    const schedulePositionUpdate = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        updateDropdownPosition();
      });
    };

    document.addEventListener("scroll", schedulePositionUpdate, true);
    window.addEventListener("resize", schedulePositionUpdate);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      document.removeEventListener("scroll", schedulePositionUpdate, true);
      window.removeEventListener("resize", schedulePositionUpdate);
    };
  }, [isOpen]);

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

  useClickOutside(
    containerRef,
    () => {
      if (isOpen) setIsOpen(false);
    },
    dropdownRef,
  );

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <Button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-2.5 py-2
          min-w-52
          bg-primary-950/5 dark:bg-primary/5
          border border-primary-950/10 dark:border-primary/5
          text-primary-900 dark:text-primary
          text-sm focus:outline-none cursor-pointer
          flex items-center justify-between
          transition-colors
          shadow-(--shadow-inset-subtle) dark:shadow-(--shadow-inset-subtle-dark)
          ${
            isOpen
              ? "rounded-t-xl shadow-lg"
              : "rounded-xl hover:bg-primary-950/5 dark:hover:bg-primary/5"
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
          className="text-primary-900 dark:text-primary-200
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
          onMouseDown={(e) => e.stopPropagation()}
          className={`fixed z-(--z-modal-critical)
            border border-t-0 border-primary-950/10 dark:border-primary/10
            rounded-b-xl shadow-lg overflow-hidden
            ${isOpen && animateIn ? "animate-dropdown-in" : "dropdown-prewarm"}
            origin-top
            bg-linear-to-b from-primary to-primary-50 dark:from-primary-900 dark:to-primary-950`}
          style={{
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
                  transition-colors px-3 py-1
                  text-s flex items-center gap-2
                  ${
                    value === option.value
                      ? "bg-primary-950/5 dark:bg-primary/10 text-primary-900 dark:text-primary "
                      : "hover:bg-primary-950/5 dark:hover:bg-primary/5 text-primary-900 dark:text-primary"
                  }
                `}
              >
                {option.icon}
                <div className="flex flex-col min-w-0">
                  <span className="truncate my-0.5">{option.label}</span>
                  {option.description && (
                    <span className="text-xxs tracking-tight text-primary-500 dark:text-primary-400 font-normal truncate">
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
