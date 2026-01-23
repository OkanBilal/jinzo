import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  Apps,
  Calendar,
  Close,
  Bell,
  Personalize,
  Security,
  Agent,
  General,
} from "@/components/ui/icons";
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

import {
  ModalBackdropProps,
  ModalContentProps,
  SettingsModalProps,
  SettingsSection,
} from "@/features/chat/components/input/types";
import { Button } from "@/components/ui/button";

export default function SettingsModal({
  open,
  apps,
  connectedApps,
  onClose,
  section,
  onRefresh,
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(section);
  const [prevOpen, setPrevOpen] = useState(open);

  // Reset activeSection when modal opens (adjust state during render, not in effect)
  if (open && !prevOpen) {
    setPrevOpen(open);
    setActiveSection(section);
  } else if (!open && prevOpen) {
    setPrevOpen(open);
  }

  if (!open) return null;

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
            onRefresh={onRefresh}
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
        return null;
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ">
      <ModalBackdrop onClick={onClose} />
      <ModalContent onClose={onClose}>
        <div className="flex h-full w-full glass-morphism">
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
          <div className="flex-1 p-6 overflow-y-auto">
            <Button
              onClick={onClose}
              aria-label="Close modal"
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer text-primary-600 dark:text-primary-200 hover:bg-primary-200 dark:hover:bg-primary-950/60 transition-colors"
            >
              <Close className="w-4 h-4" />
            </Button>
            {renderContent()}
          </div>
        </div>
      </ModalContent>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function ModalBackdrop({ onClick }: ModalBackdropProps) {
  return (
    <div
      className="absolute inset-0 bg-black/60"
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

function ModalContent({ children, onClose }: ModalContentProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="relative z-40 w-full max-w-200 mx-auto glass-morphism  rounded-3xl  h-[60vh] overflow-hidden flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        animation: "scaleIn 150ms ease-out",
      }}
    >
      {children}
    </div>
  );
}

interface SidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const menuItems: Array<{
    id: SettingsSection;
    label: string;
    icon: React.ElementType | null;
  }> = [
    { id: "general", label: "General", icon: General },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "personalization", label: "Personalization", icon: Personalize },
    { id: "apps", label: "Apps", icon: Apps },
    { id: "agent", label: "Agent", icon: Agent },
    { id: "schedules", label: "Schedules", icon: Calendar },
    { id: "security", label: "Security", icon: Security },
  ];

  return (
    <div className="w-56 shrink-0  p-4 pt-16 overflow-y-auto ">
      <nav className="space-y-1 ">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeSection === item.id;
          return (
            <Button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full cursor-pointer text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-3 ${
                isActive
                  ? " text-primary-900 dark:text-primary-100 hover:bg-primary-100 dark:hover:bg-primary-950/60 bg-primary-50 dark:bg-primary-950/60"
                  : "text-primary-700 dark:text-primary-200 hover:bg-primary-50 dark:hover:bg-primary-950/60"
              }`}
            >
              {IconComponent ? (
                <IconComponent className="w-5 h-5" />
              ) : (
                <div className="w-5 h-5 rounded bg-primary-300 dark:bg-primary-700" />
              )}
              <span>{item.label}</span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
