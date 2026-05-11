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
  | "warning"
  | "success"
  | "icon"
  | "link"
  | "subtle"
  | "frosted"
  | "bare";

export type ButtonSize = "xxs" | "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
  primary:
    "cursor-pointer bg-primary-200/60 dark:bg-primary-800/20 hover:bg-primary-200 dark:hover:bg-primary-800/40 text-primary-700 dark:text-primary-200",
  secondary:
    "cursor-pointer bg-primary-400 dark:bg-primary-200/10 hover:bg-primary-600 dark:hover:bg-primary-200/30 text-primary dark:text-primary-200",
  submit:
    "cursor-pointer bg-blue-500 hover:bg-blue-600 text-primary disabled:bg-blue-600/50",
  ghost:
    "cursor-pointer text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900",
  danger:
    "cursor-pointer text-primary bg-danger hover:bg-danger-hover disabled:bg-danger-hover/50",
  warning:
    "cursor-pointer bg-primary-200/60 text-primary-600 dark:bg-primary-700/80 dark:text-primary-200 hover:bg-primary-300/60 dark:hover:bg-primary-800/80",
  success:
    "cursor-pointer bg-green-950 text-green-600 dark:bg-green-950 dark:text-green-500 hover:bg-green-900 dark:hover:bg-green-900",
  icon: "cursor-pointer p-1 rounded-md text-primary-600 dark:text-primary-200 hover:bg-primary-200/40 dark:hover:bg-primary-700",
  link: "cursor-pointer text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline-offset-4 hover:underline ",
  subtle:
    "cursor-pointer flex items-center gap-2  hover:bg-primary/80 dark:hover:bg-primary/10 ",
  frosted:
    "cursor-pointer  text-primary-800 dark:text-primary-200 ",
  bare: "cursor-pointer",
};

const sizeStyles: Record<ButtonSize, string> = {
  xxs: "px-0 py-1 text-xs",
  xs: "px-3 py-1.5 text-xs rounded-lg",
  sm: "px-3 py-1.75 text-s rounded-lg",
  md: "px-3 py-1.75 text-s rounded-xl",
  lg: "px-3 py-2.5 text-base rounded-xl",
};

const baseStyles =
  " items-center duration-200 transition-[color,background-color,border-color,box-shadow,transform] justify-center font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      // Default to "button" instead of the native HTML default "submit" — keeps
      // a stray <Button> inside a future <form> from accidentally submitting it.
      // Callers that genuinely need submit pass `type="submit"` explicitly.
      type = "button",
      variant = "bare",
      size = "md",
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
    const sizeClass =
      variant !== "icon" && variant !== "bare" ? sizeStyles[size] : "";
    const widthClass = fullWidth ? "w-full" : "";

    const baseClass =
      variant === "bare"
        ? ""
        : variant === "frosted"
          ? "inline-flex items-center justify-center font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
          : baseStyles;

    const buttonElement = (
      <button
        ref={ref}
        type={type}
        className={cn(
          baseClass,
          variantClass,
          sizeClass,
          widthClass,
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-1.5">
            <AsciiSpinner variant="null" />
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
