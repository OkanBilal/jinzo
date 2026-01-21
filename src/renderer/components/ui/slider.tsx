import { useState, useEffect } from "react";
import NumberFlow from "@number-flow/react";
import { Caption } from "@/components/ui/text";

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
  max = 2,
  step = 0.01,
  label,
  minLabel,
  maxLabel,
  showValue = true,
  formatValue,
}: SliderProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
  };

  const handleMouseUp = () => {
    onChange(localValue);
  };

  const displayValue = formatValue ? formatValue(localValue) : localValue;
  const percentage = ((localValue - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <Caption className="text-primary-600 dark:text-primary-300">
              {label}
            </Caption>
          )}
          {showValue && (
            <Caption className="text-primary-700 dark:text-primary-200 font-mono">
              {typeof displayValue === "number" ? (
                <NumberFlow
                  value={displayValue}
                  format={{
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }}
                />
              ) : (
                displayValue
              )}
            </Caption>
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
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer [--slider-track:rgba(0,0,0,0.06)] dark:[--slider-track:rgba(255,255,255,0.1)]"
        style={{
          background: `linear-gradient(to right, #037AFF 0%, #037AFF ${percentage}%, var(--slider-track) ${percentage}%, var(--slider-track) 100%)`,
        }}
      />
      {(minLabel || maxLabel) && (
        <div className="flex justify-between">
          {minLabel && (
            <Caption className="text-primary-500 dark:text-primary-400 text-xs">
              {minLabel}
            </Caption>
          )}
          {maxLabel && (
            <Caption className="text-primary-500 dark:text-primary-400 text-xs">
              {maxLabel}
            </Caption>
          )}
        </div>
      )}
    </div>
  );
}
