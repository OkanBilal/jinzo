import { useNavigate, useLocation } from "react-router-dom";
import { Body, Button } from "@/components/ui";
import { ChevronUp } from "@/components/ui/icons";
import { useGetProjectsQuery } from "@/lib/redux/api";
import { parseIcon, type IconComponent } from "@/lib/icon-registry";
import {
  getSettingsRouteId,
  isSettingsNavItemActive,
  SETTINGS_MAIN_NAV_ITEMS,
  type SettingsRouteId,
} from "@/features/settings/settings-sections";

interface SettingsViewProps {
  onClose: () => void;
}

export default function SettingsView({ onClose }: SettingsViewProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isOnSettingsPage = location.pathname === "/settings";
  const searchParams = new URLSearchParams(location.search);
  const activeSection = getSettingsRouteId(searchParams.get("section"));
  const activeId = searchParams.get("id");

  const { data: projects = [] } = useGetProjectsQuery();

  const handleSectionClick = (sectionId: SettingsRouteId) => {
    navigate(`/settings?section=${sectionId}`);
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{
        animation: "slide-fade-down 300ms ease-in-out",
      }}
    >
      <div className="flex flex-col items-start pt-12 pb-1 px-4">
        <Body className="text-left text-sm text-primary-900 dark:text-primary font-medium ">
          Settings
        </Body>
      </div>

      <div className="flex-1 px-3 mb-1 overflow-y-auto noscrollbar">
        <nav className="space-y-0.5">
          {SETTINGS_MAIN_NAV_ITEMS.map((item) => {
            const IconComponent = item.icon;
            const isActive = isOnSettingsPage && isSettingsNavItemActive(item, activeSection);
            return (
              <Button
                key={item.id}
                onClick={() => handleSectionClick(item.id)}
                className={`w-full cursor-pointer text-left px-3 py-1.5 rounded-xl  text-sm tracking-tight transition-all flex items-center gap-2
                  ${
                    isActive
                      ? "bg-primary/80 dark:bg-primary/5 text-primary-950 dark:text-primary-100"
                      : "text-primary-800 dark:text-primary-200 bg-transparent hover:bg-primary/50 dark:hover:bg-primary/5"
                  }
                  `}
              >
                {IconComponent ? (
                  <IconComponent className={`size-3.75 `} />
                ) : (
                  <div className="size-4 rounded bg-primary-300 dark:bg-primary-700" />
                )}
                <span className="font-medium">{item.label}</span>
              </Button>
            );
          })}
        </nav>

        {/* Projects section */}
        {projects.length > 0 && (
          <div className="mt-2">
            <div className="px-3 mb-1">
              <span className="text-xs font-medium text-primary-900 dark:text-primary-200">
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
                if (parsed && parsed.type === "icon") {
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
                    className={`w-full cursor-pointer text-left px-3 py-1.5 rounded-xl text-sm tracking-tight transition-all flex items-center gap-2
                      ${
                        isActive
                          ? "bg-primary/80 dark:bg-primary/5 text-primary-900 dark:text-primary-100"
                          : "text-primary-800 dark:text-primary-200 bg-transparent hover:bg-primary/50 dark:hover:bg-primary/5"
                      }
                      `}
                  >
                    <div
                      className={`size-4.5 rounded-md flex items-center justify-center text-t font-medium text-primary-950 dark:text-primary-200
                        shrink-0 ${!parsed ? "border border-primary-950/50 dark:border-primary/10" : ""}`}
                    >
                      {iconContent}
                    </div>
                    <span className="truncate font-medium">{project.name}</span>
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
          variant="bare"
          tooltipPosition="top-right"
          size="lg"
          onClick={onClose}
          fullWidth
          className="justify-start flex items-center cursor-pointer px-2 pb-2 gap-1 bg-transparent dark:bg-transparent transition-transform duration-200"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <ChevronUp className="size-4 rotate-270 text-primary-900 dark:text-primary-200" />
          <Body className="text-primary-900 text-s dark:text-primary-200  font-medium">
            Return
          </Body>
        </Button>
      </div>
    </div>
  );
}
