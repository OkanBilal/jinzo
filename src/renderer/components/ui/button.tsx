import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";
import Tooltip, { TooltipPosition } from "./tooltip";
import { AsciiSpinner } from "./ascii-spinner";



export type ButtonVariant =
  | "primary"
  | "submit"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon"
  | "subtle"
  | "bare";


export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Tooltip text to show on hover */
  tooltip?: string;
  /** Keyboard shortcut to display in tooltip (e.g., "⌘," or "Ctrl+S") */
  tooltipShortcut?: string;
  /** Position of the tooltip */
  tooltipPosition?: TooltipPosition;
}

const variantStyles: Record<ButtonVariant, string> = {
  // Glass variants carry no bg-*/hover:bg-* — the `glass-*` utility owns the
  // background, and a hover:bg-* would win on specificity and wipe the rim.
  // Their hover fills come from the --glass-hover-* tokens in index.css.
  primary: "cursor-pointer text-primary-700 dark:text-primary-300 glass-primary",
  secondary: "cursor-pointer text-primary dark:text-primary glass-secondary",
  submit: "cursor-pointer text-primary glass-submit",
  ghost:
    "cursor-pointer text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900",
  danger: "cursor-pointer text-primary glass-danger",
  icon: "cursor-pointer p-1 rounded-md text-primary-600 dark:text-primary-400 hover:bg-primary-200/40 dark:hover:bg-primary-700",
  subtle:
    "cursor-pointer flex items-center gap-2  hover:bg-primary/80 dark:hover:bg-primary/10 ",
  bare: "cursor-pointer",
};


const baseStyles =
  "px-3 py-1.5 text-s font-medium rounded-xl items-center duration-200 transition-[color,background-color,border-color,box-shadow,transform] justify-center disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      // Default to "button" instead of the native HTML default "submit" — keeps
      // a stray <Button> inside a future <form> from accidentally submitting it.
      // Callers that genuinely need submit pass `type="submit"` explicitly.
      type = "button",
      variant = "bare",
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      className = "",
      disabled,
      tooltip,
      tooltipShortcut,
      tooltipPosition = "top",
      ...props
    },
    ref,
  ) => {
    const variantClass = variantStyles[variant];
    const widthClass = fullWidth ? "w-full" : "";

    const baseClass =
      variant === "bare"
        ? ""
          : baseStyles;

    const buttonElement = (
      <button
        ref={ref}
        type={type}
        className={cn(
          baseClass,
          variantClass,
          widthClass,
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-1.5">
            {/* `inherit` so the spinner picks up the button's own text color
                (warning, danger, provider accent…) like the label beside it. */}
            <AsciiSpinner variant="inherit" kind="circle" />
            <span>Loading...</span>
          </div>
        ) : (
          <>
            {leftIcon && <span className="mr-2">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="ml-2">{rightIcon}</span>}
          </>
        )}
      </button>
    );

    // Get tooltip content - only use explicit tooltip prop
    const tooltipContent = tooltip;

    // Wrap with tooltip if tooltip content is available
    if (tooltipContent) {
      return (
        <Tooltip
          content={tooltipContent}
          shortcut={tooltipShortcut}
          position={tooltipPosition}
          hideOnClick
        >
          {buttonElement}
        </Tooltip>
      );
    }

    return buttonElement;
  },
);

Button.displayName = "Button";
