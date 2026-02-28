import { useNavigate, useLocation } from "react-router-dom";
import { Body } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Apps,
  Personalize,
  General,
  ChevronUp,
  CopilotStatic,
  Branch,
  Chart,
} from "@/components/ui/icons";
import type { SettingsSection } from "@/features/chat/components/input/types";
import { Claude } from "@/components/ui/icons/space";
import { useGetProjectsQuery } from "@/lib/redux/api";
import { parseIcon, type IconComponent } from "@/lib/icon-registry";

interface SettingsViewProps {
  onClose: () => void;
}

type MenuItem = {
  id: SettingsSection;
  label: string;
  icon: React.ElementType | null;
};

const menuItems: Array<MenuItem> = [
  { id: "general", label: "General", icon: General },
  { id: "personalization", label: "Personalization", icon: Personalize },
  { id: "git", label: "Git", icon: Branch },
  { id: "apps", label: "Connections", icon: Apps },
  { id: "dashboard", label: "Dashboard", icon: Chart },
  // { id: "notifications", label: "Notifications", icon: Bell },
  // { id: "schedules", label: "Schedules", icon: Calendar },
  // { id: "security", label: "Security", icon: Security },
];

const providerItems: Array<MenuItem> = [
  { id: "claude", label: "Claude", icon: Claude },
  { id: "copilot", label: "Copilot", icon: CopilotStatic },
  // { id: "codex", label: "Codex", icon: Gpt }
];

export default function SettingsView({ onClose }: SettingsViewProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isOnSettingsPage = location.pathname === "/settings";
  const searchParams = new URLSearchParams(location.search);
  const activeSection = searchParams.get("section") as SettingsSection | null;
  const activeId = searchParams.get("id");

  const { data: projects = [] } = useGetProjectsQuery();

  const handleSectionClick = (sectionId: SettingsSection) => {
    navigate(`/settings?section=${sectionId}`);
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{
        animation: "slide-fade-down 300ms ease-in-out",
      }}
    >
      <div className="flex flex-col items-start pt-16 pb-2 px-4">
        <Body className="text-left text-base! text-primary-900 dark:text-primary font-medium ">
          Settings
        </Body>
      </div>

      <div className="flex-1 px-3 mb-1 overflow-y-auto noscrollbar">
        <nav className="space-y-0.5">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = isOnSettingsPage && activeSection === item.id;
            return (
              <Button
                key={item.id}
                onClick={() => handleSectionClick(item.id)}
                className={`w-full cursor-pointer text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3
                  ${
                    isActive
                      ? "bg-primary/80 dark:bg-primary/5 text-primary-950 dark:text-primary-100"
                      : "text-primary-900 dark:text-primary-200 bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
                  }
                  hover:scale-[1.01] active:scale-99`}
              >
                {IconComponent ? (
                  <IconComponent className={`size-4 `} />
                ) : (
                  <div className="w-4.5 h-4.5 rounded bg-primary-300 dark:bg-primary-700" />
                )}
                <span className="font-medium">{item.label}</span>
              </Button>
            );
          })}
        </nav>

        {/* Providers section */}
        <div className="mt-2">
          <div className="px-3 mb-1">
            <span className="text-xs font-medium text-primary-900 dark:text-primary-400">
              Agents
            </span>
          </div>
          <div className="space-y-0.5">
            {providerItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = isOnSettingsPage && activeSection === item.id;
              return (
                <Button
                  key={item.id}
                  onClick={() => handleSectionClick(item.id)}
                  className={`w-full cursor-pointer text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3
                    ${
                      isActive
                        ? "bg-primary/80 dark:bg-primary/5 text-primary-950 dark:text-primary-100"
                        : "text-primary-900 dark:text-primary-200 bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
                    }
                    hover:scale-[1.01] active:scale-99`}
                >
                  {IconComponent ? (
                    <IconComponent className={`size-4 `} />
                  ) : (
                    <div className="w-4.5 h-4.5 rounded bg-primary-300 dark:bg-primary-700" />
                  )}
                  <span className="font-medium">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Projects section */}
        {projects.length > 0 && (
          <div className="mt-2">
            <div className="px-3 mb-1">
              <span className="text-xs font-medium text-primary-900 dark:text-primary-400">
                Projects
              </span>
            </div>
            <div className="space-y-0.5">
              {projects.map((project) => {
                const isActive =
                  isOnSettingsPage &&
                  activeSection === "projects" &&
                  activeId === project.id;
                const parsed = project.icon ? parseIcon(project.icon) : null;
                const initial = (project.name?.[0] ?? "P").toUpperCase();
                let iconContent: React.ReactNode;
                if (
                  parsed &&
                  (parsed.type === "icon" ||
                    parsed.type === "copilot-animate" ||
                    parsed.type === "claude-animate")
                ) {
                  const IconComp = parsed.value as IconComponent;
                  iconContent = <IconComp className="size-4" />;
                } else if (parsed && parsed.type === "emoji") {
                  iconContent = (
                    <span className="text-sm leading-none">
                      {parsed.value as string}
                    </span>
                  );
                } else {
                  iconContent = initial;
                }
                return (
                  <Button
                    key={project.id}
                    onClick={() =>
                      navigate(`/settings?section=projects&id=${project.id}`)
                    }
                    className={`w-full cursor-pointer text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2
                      ${
                        isActive
                          ? "bg-primary/80 dark:bg-primary/5 text-primary-900 dark:text-primary-100"
                          : "text-primary-900 dark:text-primary-200 bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
                      }
                      hover:scale-[1.01] active:scale-99`}
                  >
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center text-t font-medium text-primary-950 dark:text-primary-200
                        shrink-0 ${!parsed ? "border border-primary-950/40 dark:border-primary/10" : ""}`}
                    >
                      {iconContent}
                    </div>
                    <span className="font-medium truncate">{project.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        className="px-1 pb-2 group animate-slide-up"
        style={{
          animation: `slide-from-bottom 0.2s ease-out 0.1s both`,
        }}
      >
        <Button
          tooltip={"Close settings"}
          variant="subtle"
          tooltipPosition="top-right"
          tooltipShortcut="Esc"
          size="lg"
          onClick={onClose}
          fullWidth
          className="justify-start cursor-pointer pt-1!  hover:scale-100! bg-transparent! transition-transform duration-200"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <ChevronUp className="size-4 rotate-270 text-primary-900 dark:text-primary-400" />
          <Body className="text-primary-900 text-s! dark:text-primary-100  font-medium">
            Return
          </Body>
          {/* <Caption className="ml-auto text-s! text-primary-900 dark:text-primary-400">
            Esc
          </Caption> */}
        </Button>
      </div>
    </div>
  );
}
