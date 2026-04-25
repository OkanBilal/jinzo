import { Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useBrowserPanel } from "@/hooks/use-browser-panel";
import {
  getSettingsRouteId,
  getSettingsSection,
} from "@/features/settings/settings-sections";
import { SettingsPageShell } from "@/features/settings/components/settings-layout";

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const activeSection = getSettingsRouteId(searchParams.get("section"));
  const section = getSettingsSection(activeSection);
  const { Component } = section;

  const { close: closeBrowserPanel } = useBrowserPanel();

  useEffect(() => {
    closeBrowserPanel();
  }, [closeBrowserPanel]);

  return (
    <div className="h-full max-w-240 mx-auto px-2 pt-16 overflow-y-auto noscrollbar bg-primary dark:bg-primary-950">
      <Suspense
        key={section.id}
        fallback={<SettingsPageShell title={section.label} isLoading />}
      >
        <Component />
      </Suspense>
    </div>
  );
}
