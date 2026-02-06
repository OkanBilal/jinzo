import { useState, useEffect, useRef } from "react";
import NumberFlow from "@number-flow/react";
import { Caption } from "./text";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  minLabel?: string;
  maxLabel?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  minLabel,
  maxLabel,
  showValue = true,
  formatValue,
}: SliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchend", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  const displayValue = formatValue ? formatValue(localValue) : localValue;
  const percentage = ((localValue - min) / (max - min)) * 100;

  const lineOpacity =
    percentage > 90 ? 0 : percentage > 75 ? (90 - percentage) / 15 : 1;

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative
          w-full px-3 py-4 
          overflow-hidden
          min-w-50 rounded-xl
          bg-primary-950/2 dark:bg-primary/4 
          border border-primary-950/10 dark:border-primary/10
          text-primary-900 dark:text-primary 
          text-sm focus:outline-none cursor-pointer 
          flex items-center justify-between 
          transition-all
          shadow-[inset_0_0.5px_0_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0.5px_0_rgba(255,255,255,0.03)]
        "
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-lg bg-primary-950/12 dark:bg-primary/8 ${isDragging ? "" : "transition-[width] duration-150 ease-out"}`}
          style={{ width: `${percentage}%` }}
        >
          {/* Vertical line inside percentage bar */}
          <div
            className="absolute inset-y-0 right-2 h-4.5 rounded-full top-1.75 w-[1.5px] bg-primary-950/20 dark:bg-primary/40 transition-opacity duration-150"
            style={{ opacity: lineOpacity }}
          />
        </div>

        {showValue && (
          <div className="absolute inset-y-0 right-2 flex items-center text-xs font-medium text-primary-900 dark:text-primary tabular-nums">
            {typeof displayValue === "number" ? (
              <NumberFlow
                value={displayValue}
                format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
              />
            ) : (
              displayValue
            )}
          </div>
        )}

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between">
          {minLabel && (
            <Caption className="text-primary-900! dark:text-primary-200! font-medium text-xs">
              {minLabel}
            </Caption>
          )}
          {maxLabel && (
            <Caption className="text-primary-900! dark:text-primary-200! font-medium text-xs">
              {maxLabel}
            </Caption>
          )}
        </div>
      )}
    </div>
  );
}
