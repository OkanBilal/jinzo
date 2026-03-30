import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppsSettings from "@/features/settings/components/apps/apps";
import GeneralSettings from "@/features/settings/components/general";
import NotificationsSettings from "@/features/settings/components/notifications";
import PersonalizationSettings from "@/features/settings/components/personalization";
import SchedulesSettings from "@/features/settings/components/schedules";
import SecuritySettings from "@/features/settings/components/security";
import { useGetAppsQuery } from "@/lib/redux/api";
type SettingsSection =
  | "general"
  | "notifications"
  | "personalization"
  | "apps"
  | "schedules"
  | "data"
  | "security"
  | "parental"
  | "account"
  | "claude"
  | "copilot"
  | "git"
  | "projects"
  | "codex"
  | "codex-plugins"
  | "dashboard";
import ClaudeSettings from "@/features/settings/components/claude";
import CopilotSettings from "@/features/settings/components/copilot";
import GitSettings from "@/features/settings/components/git";
import ProjectsSettings from "@/features/settings/components/projects";
import CodexSettings from "@/features/settings/components/codex";
import CodexPlugins from "@/features/settings/components/codex-plugins";
import DashboardPage from "@/features/stats/components/dashboard-page";

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

  let content: React.ReactNode;
  switch (activeSection) {
    case "general":
      content = <GeneralSettings />;
      break;
    case "notifications":
      content = <NotificationsSettings />;
      break;
    case "personalization":
      content = <PersonalizationSettings />;
      break;
    case "apps":
      content = (
        <AppsSettings
          apps={apps}
          connectedApps={connectedApps}
          onRefresh={handleRefresh}
        />
      );
      break;
    case "schedules":
      content = <SchedulesSettings />;
      break;
    case "security":
      content = <SecuritySettings />;
      break;
    case "claude":
      content = <ClaudeSettings />;
      break;
    case "copilot":
      content = <CopilotSettings />;
      break;
    case "codex":
      content = <CodexSettings />;
      break;
    case "codex-plugins":
      content = <CodexPlugins />;
      break;
    case "git":
      content = <GitSettings />;
      break;
    case "projects":
      content = <ProjectsSettings />;
      break;
    case "dashboard":
      content = <DashboardPage />;
      break;
    default:
      content = <GeneralSettings />;
  }

  return (
    <div className="h-full max-w-240 mx-auto px-2 py-16 overflow-y-auto noscrollbar bg-primary dark:bg-primary-950">
      {content}
    </div>
  );
}
