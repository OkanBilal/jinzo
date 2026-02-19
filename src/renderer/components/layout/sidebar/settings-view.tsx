import { useNavigate, useLocation } from "react-router-dom";
import { Body, Caption } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  Apps,
  Calendar,
  Bell,
  Personalize,
  Security,
  General,
  ChevronUp,
  CopilotStatic,
  Branch,
} from "@/components/ui/icons";
import type { SettingsSection } from "@/features/chat/components/input/types";
import { Claude } from "@/components/ui/icons/mood";

interface SettingsViewProps {
  onClose: () => void;
}

const menuItems: Array<{
  id: SettingsSection;
  label: string;
  icon: React.ElementType | null;
}> = [
  { id: "general", label: "General", icon: General },
  { id: "claude", label: "Claude Agent", icon: Claude },
  { id: "copilot", label: "Copilot", icon: CopilotStatic },
  { id: "git", label: "Git", icon: Branch },
  { id: "apps", label: "Connections", icon: Apps },
  { id: "personalization", label: "Personalization", icon: Personalize },
  // { id: "notifications", label: "Notifications", icon: Bell },
  // { id: "schedules", label: "Schedules", icon: Calendar },
  // { id: "security", label: "Security", icon: Security },
];

export default function SettingsView({ onClose }: SettingsViewProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isOnSettingsPage = location.pathname === "/settings";
  const searchParams = new URLSearchParams(location.search);
  const activeSection = searchParams.get("section") as SettingsSection | null;

  const handleSectionClick = (sectionId: SettingsSection) => {
    navigate(`/settings?section=${sectionId}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col items-start pt-16 pb-2 px-4">
        <Body className="text-left text-base! text-primary-900 dark:text-primary font-medium ">
          Settings
        </Body>
      </div>

      <div className="flex-1 px-3 py-2 overflow-y-auto noscrollbar">
        <nav className="space-y-0.5">
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const isActive = isOnSettingsPage && activeSection === item.id;
            return (
              <Button
                key={item.id}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => handleSectionClick(item.id)}
                className={`w-full animate-slide-in cursor-pointer text-left px-3 py-3 rounded-xl text-sm transition-all flex items-center gap-3
                  ${
                    isActive
                      ? "bg-primary/80 dark:bg-primary/5 text-primary-950 dark:text-primary-100"
                      : "text-primary-900 dark:text-primary-200 bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
                  }
                  hover:scale-[1.01] active:scale-99`}
              >
                {IconComponent ? (
                  <IconComponent className={`w-4.5 h-4.5 `} />
                ) : (
                  <div className="w-4.5 h-4.5 rounded bg-primary-300 dark:bg-primary-700" />
                )}
                <span className="font-medium">{item.label}</span>
              </Button>
            );
          })}
        </nav>
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
          <Body className="text-primary-900 text-[13px]! dark:text-primary-100  font-medium">
            Return
          </Body>
          {/* <Caption className="ml-auto text-[13px]! text-primary-900 dark:text-primary-400">
            Esc
          </Caption> */}
        </Button>
      </div>
    </div>
  );
}
