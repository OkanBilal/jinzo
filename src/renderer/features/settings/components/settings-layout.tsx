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
      <div className="flex items-start justify-between py-7 gap-8">
        <div className="shrink-0 w-80">
          <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-primary-500 dark:text-primary-500 mt-1.5">
              {description}
            </p>
          )}
        </div>
        <div className="flex-1 text-right flex justify-end">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-7">
      <div className="flex-1 pr-8">
        <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-primary-500 dark:text-primary-500 mt-1.5">
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
    <div className="border-b border-primary-200 dark:border-primary-800/50" />
  );
}
