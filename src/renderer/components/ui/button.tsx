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
  | "link"
  | "subtle"
  | "frosted";

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
    "cursor-pointer text-primary-500 dark:text-primary bg-primary-950 dark:bg-[#037AFF] hover:bg-primary-900 dark:hover:bg-[#0166DB]",
  secondary:
    "cursor-pointer bg-primary-200/60 dark:bg-primary-700/40 hover:bg-primary-200 dark:hover:bg-primary-700 text-primary-700 dark:text-primary-200",
  ghost:
    "cursor-pointer text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-800",
  danger:
    "cursor-pointer text-red-600 dark:text-primary bg-[#FB4946] hover:bg-red-50 dark:hover:bg-[#FF605E]",
  warning:
    "cursor-pointer bg-yellow-950 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-500 hover:bg-yellow-900 dark:hover:bg-yellow-900",
  success:
    "cursor-pointer bg-green-950 text-green-600 dark:bg-green-950 dark:text-green-500 hover:bg-green-900 dark:hover:bg-green-900",
  icon: "cursor-pointer p-1 rounded-md text-primary-600 dark:text-primary-200 hover:bg-primary-200/40 dark:hover:bg-primary-900/50",
  link: "cursor-pointer text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline-offset-4 hover:underline",
  subtle:
    "cursor-pointer flex items-center gap-2 bg-primary-950/2 dark:bg-primary/4 hover:bg-primary-950/4 dark:hover:bg-primary/8 transition-all duration-200  active:scale-[0.99]",
  frosted:
    "cursor-pointer bg-gradient-to-b from-white/70 to-primary-50/60 dark:from-primary-900/80 dark:to-primary-900/20 backdrop-blur-[20px] saturate-180 border border-white/40 dark:border-white/8 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.25),0_4px_16px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.16)] text-primary-800 dark:text-primary-200 transition-all duration-300 ease-out hover:scale-105",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs rounded-lg",
  sm: "px-2 py-1.5 text-sm rounded-xl",
  md: "px-2 py-2 text-sm rounded-[10px]",
  lg: "px-3 py-2.5 text-base rounded-xl",
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

    // For frosted variant, use baseStyles without transition-colors to allow transition-all from variant
    const baseClass =
      variant === "frosted"
        ? "inline-flex items-center justify-center font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
        : baseStyles;

    return (
      <button
        ref={ref}
        className={cn(
          baseClass,
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

export const SubtleButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="subtle" {...props} />);
SubtleButton.displayName = "SubtleButton";

export const FrostedButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="frosted" {...props} />);
FrostedButton.displayName = "FrostedButton";
