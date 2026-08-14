import { useState, useEffect, useCallback, useRef } from "react";
import NumberFlow from "@number-flow/react";
import { Body } from "./text";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  /**
   * Called when the drag ends, with the value it ended on. For settings whose
   * effect moves the slider itself — the interface font size rescales the whole
   * page, this control included — apply on commit and let `onChange` only drive
   * the preview, so the drag target stays under the cursor.
   */
  onCommit?: (value: number) => void;
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
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  minLabel,
  maxLabel,
  showValue = true,
  formatValue,
}: SliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // The commit fires from a window listener installed once per drag, so it
  // closes over the render that started the drag. Both the value it reports and
  // the handler it calls are read from refs refreshed after every render —
  // otherwise a caller whose `onCommit` closes over state would commit against
  // a snapshot taken at mousedown.
  const latestValue = useRef(value);
  const latestCommit = useRef(onCommit);
  useEffect(() => {
    latestValue.current = value;
    latestCommit.current = onCommit;
  });

  // Stable, so the drag listeners can be subscribed honestly rather than behind
  // a suppressed dependency check.
  const commit = useCallback(() => {
    latestCommit.current?.(latestValue.current);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    commit();
  }, [commit]);

  // Keyboard stepping never goes through the drag listeners, so commit here too.
  const handleKeyUp = commit;

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp, { passive: true });
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, handleMouseUp]);

  const displayValue = formatValue ? formatValue(value) : value;
  const percentage = ((value - min) / (max - min)) * 100;

  const lineOpacity =
    percentage > 90 ? 0 : percentage > 75 ? (90 - percentage) / 15 : 1;

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative
          w-full px-3 py-3.5
          overflow-hidden
          min-w-50 rounded-[10px]
          bg-primary-950/5 dark:bg-primary/5
          glass-outline
          text-primary-900 dark:text-primary
          text-sm focus:outline-none cursor-pointer
          flex items-center justify-between
          transition-all
          shadow-(--shadow-inset-subtle) dark:shadow-(--shadow-inset-subtle-dark)
        "
      >
        {/* The fill animates during the drag too, not just after it. Coarse
            scales (the font sizes span seven steps) otherwise snap between a
            handful of positions, which reads as stuttering rather than
            tracking; a short duration keeps it attached to the cursor. */}
        <div
          className={`absolute inset-y-0 left-0 rounded-lg bg-primary-950/12 dark:bg-primary/10 transition-[width] ease-out ${isDragging ? "duration-100" : "duration-150"}`}
          style={{ width: `${percentage}%` }}
        >
          {/* Vertical line inside percentage bar */}
          <div
            className="absolute inset-y-0 right-2 h-4 rounded-full top-1.5 w-[1.5px] bg-primary-950/20 dark:bg-primary/50 transition-opacity duration-150"
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
          value={value}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          onKeyUp={handleKeyUp}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between">
          {minLabel && (
            <Body className="text-xs">
              {minLabel}
            </Body>
          )}
          {maxLabel && (
            <Body className="text-xs">
              {maxLabel}
            </Body>
          )}
        </div>
      )}
    </div>
  );
}
