import {
  RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "../button";
import DropdownWrapper from "../dropdown-wrapper";
import { useClickOutside } from "@/hooks/use-click-outside";
import {
  formatModelDisplayName,
  getModelIcon,
  selectableModelNames,
} from "@/lib/model-icons";
import { formatEffortLevel } from "@/lib/format";
import { ArrowUp, Brain, Check } from "../icons";
import { ULTRACODE_GRADIENT_TEXT } from "./ultracode-styles";

type EffortLevel = "minimal" | "low" | "medium" | "high" | "max" | "xhigh";

interface ModelSelectDropdownProps {
  model: string;
  models: string[];
  modelEffortLevelsByModel: Record<string, EffortLevel[] | undefined>;
  onModelChange: (model: string) => void;
  thinkingMode: boolean;
  effortLevel: string;
  onEffortLevelChange: (level: string) => void;
  onThinkingModeToggle: () => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
  isLoading?: boolean;
  variant?: "claude" | "copilot" | "codex" | "cursor";
}

export function ModelSelectDropdown({
  model,
  models,
  modelEffortLevelsByModel,
  onModelChange,
  thinkingMode,
  effortLevel,
  onEffortLevelChange,
  onThinkingModeToggle,
  isOpen,
  onToggle,
  onClose,
  dropdownRef,
  openUpward = false,
  isLoading = false,
  variant,
}: ModelSelectDropdownProps) {
  const modelList = selectableModelNames(models, variant);
  const noModels = !isLoading && modelList.length === 0;
  const displayModel = formatModelDisplayName(model, variant);
  const selectedModelEffortLevels =
    modelEffortLevelsByModel[model] ?? [];
  const selectedModelUsesThinkingToggle =
    variant === "claude" && selectedModelEffortLevels.length === 0;
  const mainMenuRef = useRef<HTMLDivElement>(null);
  const effortMenuRef = useRef<HTMLDivElement>(null);
  const effortCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [effortMenuPosition, setEffortMenuPosition] = useState<{
    bottom: number;
    left: number;
  } | null>(null);
  /**
   * Whether choosing this model opens the effort / thinking submenu.
   *
   * This decides what a click on the model row means. With a submenu the click
   * is only the first half of the interaction — the menu stays open so the
   * follow-up choice can be made, and that branch closes it. Without one the
   * click is the whole interaction, so leaving the menu open just strands it.
   *
   * Claude models advertising no effort levels still get an On/Off thinking
   * toggle, so for that variant there is always a submenu.
   */
  const modelHasEffortMenu = (candidate: string) =>
    (modelEffortLevelsByModel[candidate] ?? []).length > 0 || variant === "claude";

  const hoveredModelEffortLevels = hoveredModel
    ? (modelEffortLevelsByModel[hoveredModel] ?? [])
    : [];
  const hoveredModelDisplayName = hoveredModel
    ? formatModelDisplayName(hoveredModel, variant)
    : "";
  const hoveredModelHasEffortMenu =
    !!hoveredModel && modelHasEffortMenu(hoveredModel);
  const hoveredModelSupportsUltracode =
    variant === "claude" &&
    hoveredModelEffortLevels.includes("xhigh");
  const hoveredModelHasSelectedUltracode =
    hoveredModel === model &&
    thinkingMode &&
    effortLevel === "ultracode";
  const selectedEffortLabel =
    thinkingMode && effortLevel
      ? formatEffortLevel(effortLevel)
      : selectedModelUsesThinkingToggle && thinkingMode
        ? "On"
        : "";

  useClickOutside(
    dropdownRef,
    () => {
      if (isOpen && onClose) {
        setHoveredModel(null);
        onClose();
      }
    },
    effortMenuRef,
  );

  const clearEffortCloseTimer = () => {
    if (!effortCloseTimerRef.current) return;
    clearTimeout(effortCloseTimerRef.current);
    effortCloseTimerRef.current = null;
  };

  const closeEffortMenu = () => {
    clearEffortCloseTimer();
    setHoveredModel(null);
  };

  const scheduleEffortMenuClose = () => {
    clearEffortCloseTimer();
    effortCloseTimerRef.current = setTimeout(() => {
      setHoveredModel(null);
      effortCloseTimerRef.current = null;
    }, 140);
  };

  const openEffortMenu = (hovered: string) => {
    clearEffortCloseTimer();
    if (!modelHasEffortMenu(hovered)) {
      setHoveredModel(null);
      return;
    }

    const menuRect = mainMenuRef.current?.getBoundingClientRect();
    if (!menuRect) return;

    const panelWidth = 144;
    const gap = 6;
    const fitsOnRight =
      menuRect.right + gap + panelWidth <= window.innerWidth - 8;

    setHoveredModel(hovered);
    setEffortMenuPosition({
      bottom: Math.max(8, window.innerHeight - menuRect.bottom),
      left: fitsOnRight
        ? menuRect.right + gap
        : Math.max(8, menuRect.left - panelWidth - gap),
    });
  };

  const selectModel = (candidate: string) => {
    onModelChange(candidate);
    // Models with a submenu keep the menu open so the effort/thinking choice can
    // follow; that branch closes it on selection.
    if (modelHasEffortMenu(candidate)) return;
    closeEffortMenu();
    onClose?.();
  };

  const selectEffortForHoveredModel = (level: string) => {
    if (hoveredModel && hoveredModel !== model) {
      onModelChange(hoveredModel);
    }
    onEffortLevelChange(level);
    closeEffortMenu();
    onClose?.();
  };

  const selectThinkingForHoveredModel = (enabled: boolean) => {
    if (hoveredModel && hoveredModel !== model) {
      onModelChange(hoveredModel);
    }
    if (thinkingMode !== enabled) {
      onThinkingModeToggle();
    }
    closeEffortMenu();
    onClose?.();
  };

  useEffect(
    () => () => {
      if (effortCloseTimerRef.current) {
        clearTimeout(effortCloseTimerRef.current);
      }
    },
    [],
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex cursor-pointer items-center hover:bg-primary-200/30 animate-blur-reveal dark:hover:bg-primary-800 transition-colors rounded-2xl">
        <Button
          tooltip={noModels ? "No models available" : "Select model"}
          tooltipPosition="top"
          type="button"
          onClick={
            noModels
              ? undefined
              : () => {
                  if (isOpen) closeEffortMenu();
                  onToggle();
                }
          }
          className={`text-sm  px-2 py-1.5 flex items-center gap-1.5 ${
            noModels
              ? "text-primary-400 dark:text-primary-600 cursor-not-allowed"
              : "cursor-pointer text-primary-950 dark:text-primary"
          }`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          disabled={noModels || (isLoading && !displayModel)}
        >
          {isLoading && !displayModel ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="shine-text text-sm">Loading models...</span>
            </span>
          ) : noModels ? (
            <span>No models found</span>
          ) : (
            <>
              {getModelIcon(displayModel, variant)}
              <span className="min-w-0 truncate">{displayModel}</span>
              {selectedEffortLabel && (
                <span
                  className={`shrink-0 capitalize ${
                    effortLevel === "ultracode"
                      ? `font-medium ${ULTRACODE_GRADIENT_TEXT}`
                      : "font-normal text-primary-500 dark:text-primary-300"
                  }`}
                >
                  {selectedEffortLabel}
                </span>
              )}
              <ArrowUp className={`size-3.5 shrink-0 rotate-180 ${effortLevel === "ultracode" ? "text-indigo-500 dark:text-indigo-400" : ""}`} />
            </>
          )}
        </Button>
      </div>

      <DropdownWrapper
        isOpen={isOpen}
        openUpward={openUpward}
        minWidth="min-w-48"
        dropdownRef={mainMenuRef}
      >
        <div className="max-h-80 overflow-auto noscrollbar ">
          {modelList.map((m) => {
            const displayName = formatModelDisplayName(m, variant);
            const isSelected = model === m;
            const isEffortMenuAnchor =
              hoveredModel === m && hoveredModelHasEffortMenu;
            return (
              <Button
                key={m}
                type="button"
                onClick={() => selectModel(m)}
                onMouseEnter={() => openEffortMenu(m)}
                onMouseLeave={scheduleEffortMenuClose}
                onFocus={() => openEffortMenu(m)}
                onBlur={scheduleEffortMenuClose}
                className={`w-full text-left px-3 py-2 cursor-pointer text-sm transition-colors flex items-center gap-2 ${
                  isEffortMenuAnchor
                    ? "bg-primary-200/70 dark:bg-primary-800 text-primary-950 dark:text-primary"
                    : isSelected
                    ? "bg-primary-200/60 dark:bg-primary-200/10 text-primary-950 dark:text-primary "
                    : "hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-300"
                }`}
                role="menuitemradio"
                aria-checked={isSelected}
                aria-haspopup={isEffortMenuAnchor ? "menu" : undefined}
                aria-expanded={isEffortMenuAnchor || undefined}
              >
                {getModelIcon(displayName, variant)}
                <span className="min-w-0 flex-1 truncate">{displayName}</span>
                {isSelected && <Check className="size-3.5 shrink-0" />}
              </Button>
            );
          })}
        </div>
      </DropdownWrapper>

      {isOpen &&
        hoveredModelHasEffortMenu &&
        hoveredModel &&
        effortMenuPosition &&
        createPortal(
          <div
            ref={effortMenuRef}
            onMouseEnter={clearEffortCloseTimer}
            onMouseLeave={scheduleEffortMenuClose}
            className="fixed z-(--z-dropdown-sub) min-w-36 overflow-hidden rounded-2xl glass-card animate-dropdown-in"
            style={{
              bottom: effortMenuPosition.bottom,
              left: effortMenuPosition.left,
            }}
            role="menu"
            aria-label={`${hoveredModelDisplayName} ${
              hoveredModelEffortLevels.length > 0
                ? "effort level"
                : "thinking mode"
            }`}
          >
            <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-2 text-xxs font-medium tracking-wide">
              <span className="shrink-0 text-primary-500 dark:text-primary-300">
                {getModelIcon(hoveredModelDisplayName, variant)}
              </span>
              <span className="min-w-0 flex-1 truncate text-primary-600 dark:text-primary-300">
                {hoveredModelDisplayName}
              </span>
              <span className="shrink-0 text-primary-400 dark:text-primary-500">
                {hoveredModelEffortLevels.length > 0 ? "Effort" : "Thinking"}
              </span>
            </div>

            {hoveredModelEffortLevels.length > 0 ? (
              <>
                {hoveredModelEffortLevels.map((level) => {
                  const isSelected =
                    hoveredModel === model &&
                    thinkingMode &&
                    effortLevel === level;
                  return (
                    <Button
                      key={level}
                      type="button"
                      onClick={() => selectEffortForHoveredModel(level)}
                      className={`w-full flex items-center gap-3 px-3 py-1.5 text-left text-sm capitalize transition-colors ${
                        isSelected
                          ? "bg-primary-200/60 text-primary-950 dark:bg-primary-200/10 dark:text-primary"
                          : "text-primary-700 hover:bg-primary-200/30 dark:text-primary-300 dark:hover:bg-primary-800"
                      }`}
                      role="menuitemradio"
                      aria-checked={isSelected}
                    >
                      <span className="flex-1">
                        {formatEffortLevel(level)}
                      </span>
                      {isSelected && <Check className="size-3.5 shrink-0" />}
                    </Button>
                  );
                })}

                {hoveredModelSupportsUltracode && (
                  <Button
                    type="button"
                    onClick={() =>
                      selectEffortForHoveredModel("ultracode")
                    }
                    className={`w-full flex items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors ${
                      hoveredModelHasSelectedUltracode
                        ? "bg-primary-200/60 dark:bg-primary-200/10"
                        : "hover:bg-primary-200/30 dark:hover:bg-primary-800"
                    }`}
                    role="menuitemradio"
                    aria-checked={hoveredModelHasSelectedUltracode}
                  >
                    <span
                      className={`flex-1 ${
                        hoveredModelHasSelectedUltracode
                          ? `font-medium ${ULTRACODE_GRADIENT_TEXT}`
                          : "text-primary-700 dark:text-primary-300"
                      }`}
                    >
                      Ultracode
                    </span>
                    {hoveredModelHasSelectedUltracode && (
                      <Check className="size-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
                    )}
                  </Button>
                )}
              </>
            ) : (
              <>
                {[true, false].map((enabled) => {
                  const isSelected =
                    hoveredModel === model && thinkingMode === enabled;
                  return (
                    <Button
                      key={enabled ? "on" : "off"}
                      type="button"
                      onClick={() =>
                        selectThinkingForHoveredModel(enabled)
                      }
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-primary-200/60 text-primary-950 dark:bg-primary-200/10 dark:text-primary"
                          : "text-primary-700 hover:bg-primary-200/30 dark:text-primary-300 dark:hover:bg-primary-800"
                      }`}
                      role="menuitemradio"
                      aria-checked={isSelected}
                    >
                      <Brain className="size-4 shrink-0" />
                      <span className="flex-1">
                        {enabled ? "On" : "Off"}
                      </span>
                      {isSelected && (
                        <Check className="size-3.5 shrink-0" />
                      )}
                    </Button>
                  );
                })}
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
