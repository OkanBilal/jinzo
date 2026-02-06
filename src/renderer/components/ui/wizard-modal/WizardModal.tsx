import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { WizardProvider, type WizardContextValue } from "./WizardContext";
import { usePrefersReducedMotion } from "../../../hooks/use-prefers-reduced-motion";
import { Button } from "../button";
import { Close } from "../icons";
import Text from "../text";

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

function resolveInitialStep(
  steps: { id: string }[],
  initial?: string | number,
): number {
  if (initial === undefined) return 0;
  if (typeof initial === "number") {
    return Math.max(0, Math.min(initial, steps.length - 1));
  }
  const idx = steps.findIndex((s) => s.id === initial);
  return idx >= 0 ? idx : 0;
}

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

  const [stepIndex, setStepIndex] = useState(() =>
    resolveInitialStep(steps, initialStep),
  );
  const [data, setDataState] = useState<TData>((initialData ?? {}) as TData);
  const [errors, setErrorsState] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setStepIndex(newIndex);
    }
  }, [steps, initialStep]);

  // Sync data when initialData changes (loading → actual data)
  const prevInitialDataRef = useRef(initialData);
  useEffect(() => {
    if (initialData !== prevInitialDataRef.current) {
      prevInitialDataRef.current = initialData;
      if (initialData) {
        setDataState((prev) => ({ ...prev, ...initialData }) as TData);
      }
    }
  }, [initialData]);

  // Animation state
  const [contentHeight, setContentHeight] = useState<number | "auto">("auto");
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevHeightRef = useRef<number>(0);

  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = !prefersReducedMotion && animationDuration > 0;

  const currentStep = steps[stepIndex];
  const displayTitle = currentStep?.title ?? title;

  const setData = useCallback((partial: Partial<TData>) => {
    setDataState((prev) => ({ ...prev, ...partial }));
  }, []);

  const setErrors = useCallback((partial: Record<string, string>) => {
    setErrorsState((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrorsState({});
  }, []);

  const close = useCallback(() => {
    onOpenChange(false);
    onCancel?.();
  }, [onOpenChange, onCancel]);

  useLayoutEffect(() => {
    if (!shouldAnimate || !innerRef.current) return;

    const newHeight = innerRef.current.offsetHeight;
    const prevHeight = prevHeightRef.current;

    // First render or no change - just store and skip
    if (prevHeight === 0 || Math.abs(newHeight - prevHeight) < 2) {
      prevHeightRef.current = newHeight;
      return;
    }

    // Clear any pending animation
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    // Lock to previous height immediately (before paint)
    setContentHeight(prevHeight);
    setIsAnimating(true);

    // After paint, animate to new height
    requestAnimationFrame(() => {
      setContentHeight(newHeight);
      prevHeightRef.current = newHeight;

      animationTimeoutRef.current = setTimeout(() => {
        setContentHeight("auto");
        setIsAnimating(false);
      }, animationDuration);
    });

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [stepIndex, shouldAnimate, animationDuration]);

  const goTo = useCallback(
    (indexOrId: number | string) => {
      const targetIndex =
        typeof indexOrId === "number"
          ? indexOrId
          : steps.findIndex((s) => s.id === indexOrId);

      if (targetIndex < 0 || targetIndex >= steps.length) return;
      if (targetIndex === stepIndex) return;

      setStepIndex(targetIndex);
    },
    [steps, stepIndex],
  );

  const goNext = useCallback(async () => {
    if (stepIndex >= steps.length - 1) {
      onComplete?.(data);
      return;
    }

    const step = steps[stepIndex];
    const ctx = {
      stepIndex,
      stepCount: steps.length,
      goNext: () => {},
      goBack: () => {},
      goTo: () => {},
      data,
      setData,
      errors,
      setErrors,
      clearErrors,
      isSubmitting,
      setIsSubmitting,
      close,
    } as WizardContextValue<TData>;

    if (step.canNext && !step.canNext(ctx)) return;

    if (step.onNext) {
      const result = await step.onNext(ctx);
      if (result === false) return;
    }

    setStepIndex((prev) => prev + 1);
  }, [
    stepIndex,
    steps,
    data,
    setData,
    errors,
    setErrors,
    clearErrors,
    isSubmitting,
    setIsSubmitting,
    close,
    onComplete,
  ]);

  const goBack = useCallback(async () => {
    if (stepIndex <= 0) return;

    const step = steps[stepIndex];
    const ctx = {
      stepIndex,
      stepCount: steps.length,
      goNext: () => {},
      goBack: () => {},
      goTo: () => {},
      data,
      setData,
      errors,
      setErrors,
      clearErrors,
      isSubmitting,
      setIsSubmitting,
      close,
    } as WizardContextValue<TData>;

    if (step.canBack && !step.canBack(ctx)) return;

    if (step.onBack) {
      const result = await step.onBack(ctx);
      if (result === false) return;
    }

    setStepIndex((prev) => prev - 1);
  }, [
    stepIndex,
    steps,
    data,
    setData,
    errors,
    setErrors,
    clearErrors,
    isSubmitting,
    setIsSubmitting,
    close,
  ]);

  const contextValue = useMemo<WizardContextValue<TData>>(
    () => ({
      stepIndex,
      stepCount: steps.length,
      goNext,
      goBack,
      goTo,
      data,
      setData,
      errors,
      setErrors,
      clearErrors,
      isSubmitting,
      setIsSubmitting,
      close,
    }),
    [
      stepIndex,
      steps.length,
      goNext,
      goBack,
      goTo,
      data,
      setData,
      errors,
      setErrors,
      clearErrors,
      isSubmitting,
      setIsSubmitting,
      close,
    ],
  );

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      setStepIndex(resolveInitialStep(steps, initialStep));
      setDataState((initialData ?? {}) as TData);
      setErrorsState({});
      setIsSubmitting(false);
      setContentHeight("auto");
      setIsAnimating(false);
      prevHeightRef.current = 0;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        e.preventDefault();
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isSubmitting, close]);

  useEffect(() => {
    if (!open) return;

    const modalEl = document.getElementById("wizard-modal-container");
    if (!modalEl) return;

    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const focusFirst = () => {
      const focusable =
        modalEl.querySelectorAll<HTMLElement>(focusableSelector);
      const firstFocusable = Array.from(focusable).find(
        (el) => !el.hasAttribute("disabled"),
      );
      firstFocusable?.focus();
    };

    requestAnimationFrame(focusFirst);

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        modalEl.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => !el.hasAttribute("disabled"));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [open, stepIndex]);

  if (!isBrowser || !open) return null;

  const contentStyle: React.CSSProperties = {
    height: contentHeight,
    overflow: isAnimating ? "hidden" : undefined,
    transition:
      shouldAnimate && isAnimating
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
