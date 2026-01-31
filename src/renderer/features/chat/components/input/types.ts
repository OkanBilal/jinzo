import { JournalEditingState } from "@/lib/redux/api";
import { RefObject } from "react";

export interface InputFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  context?: JournalEditingState | null;
}

export interface AppState {
  id: string;
  displayName: string;
  iconPath: string;
  isConnected: boolean;
  connectionId: string | null;
  highlighted: boolean;
  sortOrder: number;
  enabledFeatures: string | null;
  config: string | null;
}

export type ChatInputProps = InputFormProps & {
  loading?: boolean;
  className?: string;
};

export interface DictationButtonProps {
  isRecording: boolean;
  onToggle: () => void;
}

export interface SendButtonProps {
  loading: boolean;
  onSubmit: () => void;
}

export type AppItem = {
  id: string;
  displayName: string | null;
  iconPath: string | null;
  isConnected: boolean;
  connectionId: string | null;
  highlighted: boolean;
  sortOrder: number;
  enabledFeatures: string | null;
  config: string | null;
};

export interface ConnectAppsDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  apps: AppItem[];
  connectedApps: string[];
  onOpenModal: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
  selectedApp?: AppState | null;
  onClearSelectedApp?: () => void;
}

export interface AppListItemProps {
  app: AppItem;
  onConnect: (id: string) => void;
  isConnected?: boolean;
}

export interface SettingsModalProps {
  open: boolean;
  apps: AppItem[];
  connectedApps: string[];
  onClose: () => void;
  section: SettingsSection;
  onRefresh?: () => void;
}

export type SettingsSection =
  | "general"
  | "notifications"
  | "personalization"
  | "apps"
  | "schedules"
  | "data"
  | "security"
  | "parental"
  | "account"
  | "agent";

export interface ModalContentProps {
  children: React.ReactNode;
  onClose: () => void;
}

export interface ModalHeaderProps {
  onClose: () => void;
}

export type ModalFooterProps = ModalHeaderProps;

export interface ModalBackdropProps {
  onClick: () => void;
}

export interface AppsListProps {
  apps: AppItem[];
  connectedApps: string[];
  onConnect: (id: string) => void;
}

export interface AppIconProps {
  app: AppItem;
}

export interface AppInfoProps {
  name: string;
  isConnected: boolean;
}

export interface ConnectButtonProps {
  appId: string;
  isConnected: boolean;
  onConnect: (id: string) => void;
}

export interface UploadedFile {
  file: File;
  preview?: string;
  type: "image" | "document";
}

export interface FileUploadDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onImageUpload: () => void;
  onDocumentUpload: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (index: number) => void;
}

export interface ModelSelectDropdownProps {
  model: string;
  models: string[];
  onModelChange: (model: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
}
