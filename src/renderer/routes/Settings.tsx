import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppsSettings from "@/features/settings/components/apps/apps";
import GeneralSettings from "@/features/settings/components/general";
import NotificationsSettings from "@/features/settings/components/notifications";
import PersonalizationSettings from "@/features/settings/components/personalization";
import SchedulesSettings from "@/features/settings/components/schedules";
import SecuritySettings from "@/features/settings/components/security";
import { useGetAppsQuery } from "@/lib/redux/api";
import type { SettingsSection } from "@/features/chat/components/input/types";
import ClaudeSettings from "@/features/settings/components/claude";
import CopilotSettings from "@/features/settings/components/copilot";

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get("section") as SettingsSection | null;
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    sectionParam || "general",
  );

  const { data: apps = [], refetch: refetchApps } = useGetAppsQuery();
  const connectedApps = apps
    .filter((app) => app.isConnected)
    .map((app) => app.id);

  const [prevSectionParam, setPrevSectionParam] = useState(sectionParam);
  if (sectionParam !== prevSectionParam) {
    setPrevSectionParam(sectionParam);
    if (sectionParam) {
      setActiveSection(sectionParam);
    }
  }

  const handleRefresh = async () => {
    await refetchApps();
  };

  const renderContent = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings />;
      case "notifications":
        return <NotificationsSettings />;
      case "personalization":
        return <PersonalizationSettings />;
      case "apps":
        return (
          <AppsSettings
            apps={apps}
            connectedApps={connectedApps}
            onRefresh={handleRefresh}
          />
        );
      case "schedules":
        return <SchedulesSettings />;
      case "security":
        return <SecuritySettings />;
      case "claude":
        return <ClaudeSettings />;
      case "copilot":
        return <CopilotSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className="h-full max-w-200 mx-auto px-6 pt-16 overflow-y-auto bg-primary dark:bg-primary-950">
      {renderContent()}
    </div>
  );
}
