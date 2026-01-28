import { RefObject } from "react";

export interface InputFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
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
