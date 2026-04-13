import { useState, RefObject } from "react";
import { Attach, Picture, Document, Close } from "../icons";
import DropdownWrapper from "../dropdown-wrapper";
import { Button } from "../button";

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
  variant?: "claude" | "copilot" | "codex" | "cursor";
}

export function FileUploadDropdown({
  isOpen,
  onToggle,
  onImageUpload,
  onDocumentUpload,
  dropdownRef,
  openUpward = false,
  uploadedFiles,
  onRemoveFile,
  variant,
}: FileUploadDropdownProps) {
  const [hoveredFileIndex, setHoveredFileIndex] = useState<number | null>(null);

  if (variant === "codex") {
    return (
      <div className="relative flex items-center gap-2 animate-blur-reveal" ref={dropdownRef}>
        <Button
          type="button"
          tooltip="Upload image"
          tooltipPosition="top"
          onClick={onImageUpload}
          className="p-1.5 hover:bg-primary-200/30 dark:hover:bg-primary-300/20 rounded-full transition-colors cursor-pointer"
          aria-label="Upload image"
        >
          <Picture className="dark:text-primary-300 size-4 text-primary-700" />
        </Button>
        {uploadedFiles.map((uploadedFile, index) => (
          <div
            key={`${uploadedFile.file.name}-${uploadedFile.file.size}`}
            className="relative group"
          >
            <div className="flex items-center gap-2 bg-primary-100 dark:bg-primary-800 rounded-2xl px-1.5 py-1 mr-1">
              <div className="relative w-5 h-5 rounded overflow-hidden">
                <img
                  src={uploadedFile.preview}
                  alt={uploadedFile.file.name}
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  onClick={() => onRemoveFile(index)}
                  className="absolute cursor-pointer inset-0 bg-primary-950/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <Close className="w-4 h-4 text-primary-600 dark:text-primary-300" />
                </Button>
              </div>
              <span className="text-primary-700 dark:text-primary-200 text-xs max-w-25 truncate">
                {uploadedFile.file.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2 animate-blur-reveal" ref={dropdownRef}>
      <Button
        type="button"
        tooltip="Upload file or photo"
        tooltipPosition="top"
        onClick={onToggle}
        className="p-1.5 hover:bg-primary-200/30 dark:hover:bg-primary-300/20 rounded-full transition-colors cursor-pointer"
        aria-label="Upload file"
        aria-expanded={isOpen}
      >
        <Attach className="dark:text-primary-300 text-primary-700" />
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
              className="flex items-center gap-2 bg-primary-100 dark:bg-primary-800 rounded-2xl px-1.5 py-1 mr-1"
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
                    className="absolute cursor-pointer inset-0 bg-primary-950/50 flex items-center justify-center transition-opacity"
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
              className="flex items-center gap-2 px-2 py-1.5 bg-primary-100 dark:bg-primary-800 rounded-2xl mr-1"
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
            className="flex w-full text-left text-sm first:rounded-t-xl text-primary-900 dark:text-primary-200 last:rounded-b-xl items-center px-3 py-2.5 hover:bg-primary-200/30 dark:hover:bg-primary-800 cursor-pointer"
          >
            <Icon className="mr-2 size-3.5" />
            {label}
          </Button>
        ))}
      </DropdownWrapper>
    </div>
  );
}
