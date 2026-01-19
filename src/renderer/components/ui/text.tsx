import { ElementType, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type TextVariant =
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "bodyMedium"
  | "bodySmall"
  | "muted"
  | "mutedSmall"
  | "label"
  | "labelSmall"
  | "button"
  | "buttonSmall"
  | "error"
  | "errorSmall"
  | "caption"
  | "timestamp";

export interface TextProps {
  variant?: TextVariant;
  children: ReactNode;
  className?: string;
  as?: ElementType;
  align?: "left" | "center" | "right";
}

const variantStyles: Record<TextVariant, string> = {
  h1: "text-3xl tracking-tight dark:text-primary-100 text-primary-950 font-medium",
  h2: "text-2xl font-semibold text-primary-900 dark:text-primary-100",
  h3: "text-lg font-semibold text-primary-900 dark:text-primary-100",

  body: "text-sm text-primary-700 dark:text-primary-200",
  bodyMedium: "text-sm font-medium text-primary-900 dark:text-primary-100",
  bodySmall: "text-xs text-primary-700 dark:text-primary-200",

  muted: "text-sm text-primary-600 dark:text-primary-400",
  mutedSmall: "text-xs text-primary-500 dark:text-primary-400",

  label: "text-sm font-medium text-primary-700 dark:text-primary-300",
  labelSmall:
    "text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wide",

  button: "text-sm font-medium",
  buttonSmall: "text-xs font-medium",

  error: "text-sm text-red-600 dark:text-red-400",
  errorSmall: "text-xs text-red-600 dark:text-red-400",

  caption: "text-xs text-primary-500 dark:text-primary-400",
  timestamp: "text-xs text-primary-500 font-medium",
};

const defaultElements: Record<TextVariant, ElementType> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  body: "p",
  bodyMedium: "p",
  bodySmall: "span",
  muted: "p",
  mutedSmall: "span",
  label: "label",
  labelSmall: "span",
  button: "span",
  buttonSmall: "span",
  error: "p",
  errorSmall: "span",
  caption: "span",
  timestamp: "span",
};

export default function Text({
  variant = "body",
  children,
  className,
  as,
  align,
}: TextProps) {
  const Component = as || defaultElements[variant];
  const alignClass = align ? `text-${align}` : "";

  return (
    <Component
      className={cn(variantStyles[variant], alignClass, className)}
      {...(as ? {} : {})}
    >
      {children}
    </Component>
  );
}

const Heading1 = ({
  children,
  className,
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="h1" className={className} align={align} {...props}>
    {children}
  </Text>
);

const Heading2 = ({
  children,
  className,
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="h2" className={className} align={align} {...props}>
    {children}
  </Text>
);

const Heading3 = ({
  children,
  className,
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="h3" className={className} align={align} {...props}>
    {children}
  </Text>
);

const Body = ({
  children,
  className,
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="body" className={className} align={align} {...props}>
    {children}
  </Text>
);

const BodyMedium = ({
  children,
  className,
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="bodyMedium" className={className} align={align} {...props}>
    {children}
  </Text>
);

const Muted = ({
  children,
  className,
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="muted" className={className} align={align} {...props}>
    {children}
  </Text>
);

const Label = ({
  children,
  className,
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="label" className={className} align={align} {...props}>
    {children}
  </Text>
);

const ErrorText = ({
  children,
  className,
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="error" className={className} align={align} {...props}>
    {children}
  </Text>
);

const Caption = ({
  children,
  className,
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="caption" className={className} align={align} {...props}>
    {children}
  </Text>
);

const Timestamp = ({
  children,
  className,  
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="timestamp" className={className} align={align} {...props}>
    {children}
  </Text>
);

export {
  Heading1,
  Heading2,
  Heading3,
  Body,
  BodyMedium,
  Muted,
  Label,
  ErrorText,
  Caption,
  Timestamp,
};
