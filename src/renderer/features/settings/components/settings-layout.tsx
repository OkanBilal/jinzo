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
      <div className="rounded-3xl bg-primary-100/60 dark:bg-primary-900/40 border border-primary-200/50 dark:border-primary-800/20 px-5">
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
            <p className="text-[13px] text-primary-500 dark:text-primary-500 mt-1">
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
          <p className="text-[13px] text-primary-500 dark:text-primary-500 mt-1">
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
