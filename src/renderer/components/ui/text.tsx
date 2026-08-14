import { ElementType, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type TextVariant =
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "muted"
  | "label"
  | "button"
  | "buttonSmall"
  | "error"
  | "caption"
  | "tiny"
export interface TextProps {
  variant?: TextVariant;
  children: ReactNode;
  className?: string;
  as?: ElementType;
  align?: "left" | "center" | "right";
}

const variantStyles: Record<TextVariant, string> = {
  h1: "text-3xl text-primary-900 dark:text-primary-100",
  h2: "text-2xl text-primary-900 dark:text-primary-100",
  h3: "text-xl text-primary-900 dark:text-primary-100",

  body: "text-sm text-primary-900 dark:text-primary-100",

  muted: "text-sm text-primary-700 dark:text-primary-300",

  label: "text-sm font-medium text-primary-700 dark:text-primary-300",

  button: "text-sm font-medium",
  buttonSmall: "text-xs font-medium",

  error: "text-sm text-red-700 dark:text-red-300",

  caption: "text-xs text-primary-700 dark:text-primary-300",

  tiny: "text-s text-primary-900 dark:text-primary-100",
};

const defaultElements: Record<TextVariant, ElementType> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  body: "p",
  muted: "p",
  label: "label",
  button: "span",
  buttonSmall: "span",
  error: "p",
  caption: "span",
  tiny: "span",
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

const Tiny = ({
  children,
  className,
  align,
  ...props
}: Omit<TextProps, "variant">) => (
  <Text variant="tiny" className={className} align={align} {...props}>
    {children}
  </Text>
);
export {
  Heading1,
  Heading2,
  Heading3,
  Body,
  Muted,
  Label,
  ErrorText,
  Caption,
  Tiny,
};
