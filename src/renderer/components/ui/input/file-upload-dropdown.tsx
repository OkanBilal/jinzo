import { useState, RefObject } from "react";
import { Attach, Picture, Document, Close } from "@/components/ui/icons";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import { Button } from "@/components/ui/button";
import type { InputVariant } from "./send-button";

export interface UploadedFile {
  file: File;
  type: "image" | "document";
  preview?: string;
}

export const FILE_TYPES = {
  IMAGE: "image/*",
  DOCUMENT: ".pdf,.doc,.docx,.txt",
} as const;

interface FileUploadDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onImageUpload: () => void;
  onDocumentUpload: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
  openUpward?: boolean;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (index: number) => void;
  variant?: InputVariant;
}

const variantStyles = {
  default: {
    button: "hover:bg-primary-200/30 dark:hover:bg-primary-800",
    icon: "dark:text-primary-400 text-primary-500",
    fileBg: "bg-primary-100 dark:bg-primary-800",
    menuItem: "hover:bg-primary-200/30 dark:hover:bg-primary-600/20",
  },
  copilot: {
    button: "hover:bg-primary-200/30 dark:hover:bg-copilot-lightblue/10",
    icon: "dark:text-copilot-lightblue text-primary-800",
    fileBg: "bg-primary-100 dark:bg-copilot-lightblue/10",
    menuItem: "hover:bg-copilot-lightblue dark:hover:bg-copilot-lightblue/10",
  },
  claude: {
    button: "hover:bg-primary-200/30 dark:hover:bg-claude-light/10",
    icon: "dark:text-claude-light text-primary-800",
    fileBg: "bg-primary-100 dark:bg-claude-light/10",
    menuItem: "hover:bg-claude-light dark:hover:bg-claude-light/10",
  },
};

//TODO: implement for chat and code sessions file handling
export function FileUploadDropdown({
  isOpen,
  onToggle,
  onImageUpload,
  onDocumentUpload,
  dropdownRef,
  openUpward = false,
  uploadedFiles,
  onRemoveFile,
  variant = "default",
}: FileUploadDropdownProps) {
  const [hoveredFileIndex, setHoveredFileIndex] = useState<number | null>(null);
  const styles = variantStyles[variant];

  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      <Button
        type="button"
        tooltip="Upload file or photo"
        tooltipPosition="top"
        onClick={onToggle}
        className={`p-1.5 ${styles.button} rounded-full transition-colors cursor-pointer`}
        aria-label="Upload file"
        aria-expanded={isOpen}
      >
        <Attach className={`${styles.icon} `} />
      </Button>
      {uploadedFiles.map((uploadedFile, index) => (
        <div
          key={`${uploadedFile.file.name}-${uploadedFile.file.size}`}
          className="relative"
          onMouseEnter={() => setHoveredFileIndex(index)}
          onMouseLeave={() => setHoveredFileIndex(null)}
        >
          {uploadedFile.type === "image" ? (
            <div
              className={`flex items-center gap-2 ${styles.fileBg} rounded-2xl px-1.5 py-1 mr-1`}
            >
              <div className="relative w-5 h-5 rounded overflow-hidden group">
                <img
                  src={uploadedFile.preview}
                  alt={uploadedFile.file.name}
                  className="w-full h-full object-cover"
                />

                {hoveredFileIndex === index && (
                  <Button
                    type="button"
                    onClick={() => onRemoveFile(index)}
                    className="absolute cursor-pointer inset-0 bg-black/50 flex items-center justify-center transition-opacity"
                    aria-label="Remove image"
                  >
                    <Close className="w-4 h-4 text-primary-600 dark:text-primary-300" />
                  </Button>
                )}
              </div>
              <span className="text-primary-700 dark:text-primary-200 text-xs max-w-25 truncate">
                {uploadedFile.file.name}
              </span>
            </div>
          ) : (
            <div
              className={`flex items-center gap-2 px-2 py-1.5 ${styles.fileBg} rounded-2xl mr-1`}
            >
              {hoveredFileIndex === index ? (
                <Button
                  type="button"
                  onClick={() => onRemoveFile(index)}
                  className="flex items-center gap-2 cursor-pointer"
                  aria-label="Remove document"
                >
                  <Close className="w-4 h-4 text-primary-600 dark:text-primary-300" />
                  <span className="text-xs text-primary-700 dark:text-primary-200 max-w-25 truncate">
                    {uploadedFile.file.name}
                  </span>
                </Button>
              ) : (
                <>
                  <Document className="w-4 h-4 text-primary-700 dark:text-primary-200" />
                  <span className="text-xs text-primary-700 dark:text-primary-200 max-w-25 truncate">
                    {uploadedFile.file.name}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      <DropdownWrapper
        isOpen={isOpen}
        openUpward={openUpward}
        useFixedBackground={true}
      >
        {[
          { label: "Images", Icon: Picture, onClick: onImageUpload },
          { label: "Documents", Icon: Document, onClick: onDocumentUpload },
        ].map(({ label, Icon, onClick }) => (
          <Button
            key={label}
            type="button"
            onClick={onClick}
            role="menuitem"
            className={`flex w-full text-left text-sm first:rounded-t-xl last:rounded-b-xl items-center px-3 py-2.5 ${styles.menuItem} text-primary-700 dark:text-primary-100 cursor-pointer`}
          >
            <Icon className="mr-2 size-3.5" />
            {label}
          </Button>
        ))}
      </DropdownWrapper>
    </div>
  );
}
