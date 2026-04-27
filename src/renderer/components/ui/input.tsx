import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "../../lib/cn";

const baseInputClasses =
  "w-full rounded-xl border min-w-60 border-primary-200/70 dark:border-primary/5 bg-primary/80 dark:bg-primary-950/50 px-3 py-2 text-sm text-primary-900 dark:text-primary-100  placeholder:text-primary-400 dark:placeholder:text-primary-400 focus:outline-none transition disabled:opacity-60 disabled:cursor-not-allowed";
const errorClasses =
  "border-red-300 focus:ring-red-300 focus:border-red-400 dark:border-red-800 dark:focus:ring-red-600";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", hasError, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(baseInputClasses, hasError && errorClasses, className)}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", hasError, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        baseInputClasses,
        "resize-y min-h-16",
        hasError && errorClasses,
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", hasError, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        baseInputClasses,
        "pr-10 appearance-none",
        hasError && errorClasses,
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);

Select.displayName = "Select";
