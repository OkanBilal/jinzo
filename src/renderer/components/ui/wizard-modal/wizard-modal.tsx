import {
  useRef,
  useEffect,
  useCallback,
  useSyncExternalStore,
  useReducer,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { WizardProvider, type WizardContextValue } from "./wizard-context";
import { usePrefersReducedMotion } from "../../../hooks/use-prefers-reduced-motion";
import { Button } from "../button";
import { Close } from "../icons";
import Text from "../text";
import { wizardReducer, resolveInitialStep } from "./wizard-reducer";
import { useWizardEscape, useWizardFocusTrap } from "./use-wizard-keyboard";
import { useWizardAnimation } from "./use-wizard-animation";
import { useWizardNavigation } from "./use-wizard-navigation";

export interface WizardStep<
  TData extends Record<string, any> = Record<string, any>,
> {
  id: string;
  title?: string;
  render: (ctx: WizardContextValue<TData>) => React.ReactNode;
  canNext?: (ctx: WizardContextValue<TData>) => boolean;
  canBack?: (ctx: WizardContextValue<TData>) => boolean;
  onNext?: (
    ctx: WizardContextValue<TData>,
  ) => boolean | void | Promise<boolean | void>;
  onBack?: (
    ctx: WizardContextValue<TData>,
  ) => boolean | void | Promise<boolean | void>;
}

export interface WizardModalProps<
  TData extends Record<string, any> = Record<string, any>,
> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: WizardStep<TData>[];
  initialStep?: string | number;
  initialData?: Partial<TData>;
  title?: string;
  icon?: string;
  onComplete?: (data: TData) => void;
  onCancel?: () => void;
  className?: string;
  animationDuration?: number;
}

const emptySubscribe = () => () => {};

export function WizardModal<
  TData extends Record<string, any> = Record<string, any>,
>({
  open,
  onOpenChange,
  steps,
  initialStep,
  initialData,
  title,
  icon,
  onComplete,
  onCancel,
  className = "",
  animationDuration = 200,
}: WizardModalProps<TData>) {
  const isBrowser = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const [state, dispatch] = useReducer(
    wizardReducer<TData>,
    undefined,
    () => ({
      stepIndex: resolveInitialStep(steps, initialStep),
      data: (initialData ?? {}) as TData,
      errors: {} as Record<string, string>,
      isSubmitting: false,
      animState: { height: "auto" as number | "auto", active: false },
    }),
  );

  const { stepIndex, data, errors, isSubmitting, animState } = state;

  // Sync stepIndex when steps array changes (e.g., loading → real steps)
  const prevStepsLengthRef = useRef(steps.length);
  const prevStepIdsRef = useRef(steps.map((s) => s.id).join(","));
  useEffect(() => {
    const prevLen = prevStepsLengthRef.current;
    const newLen = steps.length;
    const prevIds = prevStepIdsRef.current;
    const newIds = steps.map((s) => s.id).join(",");

    prevStepsLengthRef.current = newLen;
    prevStepIdsRef.current = newIds;

    // Only sync when steps array structure actually changed (loading → actual steps)
    if (prevLen !== newLen || prevIds !== newIds) {
      const newIndex = resolveInitialStep(steps, initialStep);
      dispatch({ type: "SET_STEP", index: newIndex });
    }
  }, [steps, initialStep]);

  // Sync data when initialData changes (loading → actual data)
  const prevInitialDataRef = useRef(initialData);
  useEffect(() => {
    if (initialData !== prevInitialDataRef.current) {
      prevInitialDataRef.current = initialData;
      if (initialData) {
        dispatch({ type: "SET_DATA", data: initialData as Partial<TData> });
      }
    }
  }, [initialData]);

  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = !prefersReducedMotion && animationDuration > 0;

  const currentStep = steps[stepIndex];
  const displayTitle = currentStep?.title ?? title;

  const setData = useCallback((partial: Partial<TData>) => {
    dispatch({ type: "SET_DATA", data: partial });
  }, []);

  const setErrors = useCallback((partial: Record<string, string>) => {
    dispatch({ type: "SET_ERRORS", errors: partial });
  }, []);

  const clearErrors = useCallback(() => {
    dispatch({ type: "CLEAR_ERRORS" });
  }, []);

  const setIsSubmitting = useCallback((value: boolean) => {
    dispatch({ type: "SET_SUBMITTING", value });
  }, []);

  const close = useCallback(() => {
    onOpenChange(false);
    onCancel?.();
  }, [onOpenChange, onCancel]);

  // Extracted hooks
  const prevHeightRef = useWizardAnimation(
    stepIndex,
    shouldAnimate,
    animationDuration,
    innerRef,
    dispatch,
  );
  useWizardEscape(open, isSubmitting, close);
  useWizardFocusTrap(open, stepIndex);

  const { contextValue } = useWizardNavigation<TData>({
    steps,
    stepIndex,
    data,
    errors,
    isSubmitting,
    setData,
    setErrors,
    clearErrors,
    setIsSubmitting,
    close,
    onComplete,
    dispatch,
  });

  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    dispatch({
      type: "RESET",
      stepIndex: resolveInitialStep(steps, initialStep),
      data: (initialData ?? {}) as TData,
    });
  }
  if (!open && prevOpen) {
    setPrevOpen(false);
  }

  // Manage focus save/restore as a DOM side effect
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      prevHeightRef.current = 0;
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isBrowser || !open) return null;

  const contentStyle: React.CSSProperties = {
    height: animState.height,
    overflow: animState.active ? "hidden" : undefined,
    transition:
      shouldAnimate && animState.active
        ? `height ${animationDuration}ms ease-out`
        : undefined,
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !isSubmitting && close()}
        aria-hidden="true"
      />

      <div
        id="wizard-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        className={`relative z-50 w-full max-w-2xl rounded-3xl overflow-hidden glass-morphism ${className}`}
        style={{
          animation: shouldAnimate
            ? "wizardModalIn 250ms cubic-bezier(0.22, 1, 0.36, 1) both"
            : undefined,
        }}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            {icon && (
              <img
                src={icon}
                alt=""
                className="w-10 h-10"
                width={256}
                height={256}
              />
            )}
            <span id="wizard-title">
              <Text variant="h3">{displayTitle}</Text>
            </span>
          </div>
          <Button
            onClick={() => !isSubmitting && close()}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="p-2 flex cursor-pointer items-center justify-center rounded-full text-primary-600 dark:text-primary-400 hover:bg-primary-200/60 dark:hover:bg-primary-800 transition-colors"
          >
            <Close className="w-4 h-4" />
          </Button>
        </div>

        {/* Animated height container */}
        <div ref={contentRef} style={contentStyle}>
          {/* Inner wrapper for measuring natural height */}
          <div ref={innerRef} className="p-6">
            <WizardProvider value={contextValue}>
              {/* Step content with fade animation */}
              <div
                key={stepIndex}
                style={{
                  animation: shouldAnimate
                    ? "wizardStepFade 150ms ease-out"
                    : undefined,
                }}
              >
                {currentStep?.render(contextValue)}
              </div>
            </WizardProvider>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes wizardModalIn {
          0% {
            opacity: 0;
            transform: scale(0.2);
          }
          70% {
            opacity: 1;
            transform: scale(1.015);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes wizardStepFade {
          from { opacity: 0.6; }
          to { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
