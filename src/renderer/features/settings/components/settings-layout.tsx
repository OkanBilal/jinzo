import type { ReactNode } from "react";
import { Heading2, Muted } from "@/components/ui";

export function SettingsPageShell({
  title,
  isLoading,
  error,
  loadingMessage = "Loading...",
  errorMessage,
  headerActions,
  className = "",
  children,
}: {
  title: string;
  isLoading?: boolean;
  error?: unknown;
  loadingMessage?: string;
  errorMessage?: string;
  headerActions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const header = headerActions ? (
    <div className="flex items-center justify-between mb-8">
      <Heading2>{title}</Heading2>
      {headerActions}
    </div>
  ) : (
    <div className="mb-8">
      <Heading2>{title}</Heading2>
    </div>
  );

  let body: ReactNode;
  if (isLoading) {
    body = <Muted>{loadingMessage}</Muted>;
  } else if (error) {
    body = (
      <Muted>{errorMessage ?? `Unable to load ${title.toLowerCase()}.`}</Muted>
    );
  } else {
    body = children;
  }

  return (
    <div className={`bg-primary dark:bg-primary-950 ${className}`}>
      {header}
      {body}
    </div>
  );
}

export function PlaceholderSection({ title }: { title: string }) {
  return (
    <SettingsPageShell title={title}>
      <Muted>{title} settings will be available here.</Muted>
    </SettingsPageShell>
  );
}

export function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      {title && (
        <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-3">
          {title}
        </h3>
      )}
      <div className="rounded-3xl glass-morphism px-5 py-1">
        {children}
      </div>
    </div>
  );
}

export function SettingsRow({
  title,
  description,
  children,
  variant = "default",
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "detail";
}) {
  if (variant === "detail") {
    return (
      <div className="flex items-start justify-between py-5 gap-8">
        <div className="shrink-0 w-80">
          <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100">
            {title}
          </h3>
          {description && (
            <p className="text-s text-primary-500 dark:text-primary-500 mt-1">
              {description}
            </p>
          )}
        </div>
        <div className="flex-1 text-right flex justify-end">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 pr-8">
        <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100">
          {title}
        </h3>
        {description && (
          <p className="text-s text-primary-500 dark:text-primary-500 mt-1 ">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsDivider() {
  return (
    <div className="border-b border-primary-200/60 dark:border-primary-800/20" />
  );
}
