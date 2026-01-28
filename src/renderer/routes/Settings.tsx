import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AccountSettings from "@/features/settings/components/account";
import AppsSettings from "@/features/settings/components/apps/apps";
import DataControlsSettings from "@/features/settings/components/data-controls";
import GeneralSettings from "@/features/settings/components/general";
import NotificationsSettings from "@/features/settings/components/notifications";
import ParentalControlsSettings from "@/features/settings/components/parental-controls";
import PersonalizationSettings from "@/features/settings/components/personalization";
import SchedulesSettings from "@/features/settings/components/schedules";
import SecuritySettings from "@/features/settings/components/security";
import AgentSettings from "@/features/settings/components/agent";
import { useGetAppsQuery } from "@/lib/redux/api";
import type { SettingsSection } from "@/features/chat/components/input/types";

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
      case "data":
        return <DataControlsSettings />;
      case "security":
        return <SecuritySettings />;
      case "parental":
        return <ParentalControlsSettings />;
      case "account":
        return <AccountSettings />;
      case "agent":
        return <AgentSettings />;
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
