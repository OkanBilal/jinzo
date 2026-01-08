import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "warning"
  | "success"
  | "icon"
  | "link";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "cursor-pointer text-primary-500 dark:text-primary-900 bg-primary-950 dark:bg-primary-300 hover:bg-primary-900 dark:hover:bg-primary-200",
  secondary:
    "cursor-pointer bg-primary-200/60 dark:bg-primary-700/40 hover:bg-primary-200 dark:hover:bg-primary-700 text-primary-700 dark:text-primary-200",
  ghost:
    "cursor-pointer text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-800",
  danger:
    "cursor-pointer text-red-600 dark:text-red-400 bg-red-950 hover:bg-red-50 dark:hover:bg-red-900/20",
  warning:
    "cursor-pointer bg-yellow-950 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-500 hover:bg-yellow-900 dark:hover:bg-yellow-900",
  success:
    "cursor-pointer bg-green-950 text-green-600 dark:bg-green-950 dark:text-green-500 hover:bg-green-900 dark:hover:bg-green-900",
  icon: "cursor-pointer p-1 rounded-md text-primary-600 dark:text-primary-200 hover:bg-primary-200/40 dark:hover:bg-primary-900/50",
  link: "cursor-pointer text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline-offset-4 hover:underline",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-3 py-1.5 text-xs rounded-lg",
  sm: "px-3 py-2 text-sm rounded-xl",
  md: "px-3 py-2.5 text-sm rounded-xl",
  lg: "px-4 py-3 text-base rounded-xl",
};

const baseStyles =
  "inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const variantClass = variantStyles[variant];
    const sizeClass = variant !== "icon" ? sizeStyles[size] : "";
    const widthClass = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantClass,
          sizeClass,
          widthClass,
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          <>
            {leftIcon && <span className="mr-2">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="ml-2">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export const PrimaryButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="primary" {...props} />);
PrimaryButton.displayName = "PrimaryButton";

export const SecondaryButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="secondary" {...props} />);
SecondaryButton.displayName = "SecondaryButton";

export const GhostButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="ghost" {...props} />);
GhostButton.displayName = "GhostButton";

export const DangerButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="danger" {...props} />);
DangerButton.displayName = "DangerButton";

export const WarningButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="warning" {...props} />);
WarningButton.displayName = "WarningButton";

export const SuccessButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="success" {...props} />);
SuccessButton.displayName = "SuccessButton";

export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="icon" {...props} />);
IconButton.displayName = "IconButton";

export const LinkButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="link" {...props} />);
LinkButton.displayName = "LinkButton";
