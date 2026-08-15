import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Caption, Button, Body, Input } from "@/components/ui";
import { useCapabilities } from "@/lib/platform";

interface CreateProjectModalProps {
  isOpen: boolean;
  isCreating: boolean;
  onCreate: (name: string, parentPath?: string) => void;
  onClose: () => void;
}

const INVALID_NAME = /[\\/:*?"<>|]|^\.+$|^\s|\s$/;

export default function CreateProjectModal({
  isOpen,
  isCreating,
  onCreate,
  onClose,
}: CreateProjectModalProps) {
  const { nativeDialogs } = useCapabilities();
  const [name, setName] = useState("");
  const [parentPath, setParentPath] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setName("");
    setParentPath("");
  }
  if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const trimmed = name.trim();
  const isInvalid = trimmed.length === 0 || INVALID_NAME.test(trimmed);

  const handleBrowse = async () => {
    try {
      const result = await window.api.workspace.selectDirectory();
      if (result?.success && result.data) {
        setParentPath(result.data);
      }
    } catch {
      // User cancelled
    }
  };

  const handleSubmit = () => {
    if (isInvalid) return;
    onCreate(trimmed, parentPath.trim() || undefined);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-(--z-modal-critical) flex items-center justify-center bg-primary-950/55"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="rounded-4xl px-6 pt-5 pb-6 glass-surface max-w-md w-full animate-dropdown-in origin-center"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Body weight="medium" className="mb-2">
          Create New Project
        </Body>

        <div className="space-y-4">
          <div>
            <Caption className="mb-1.5 block">
              Project Name
            </Caption>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-new-project"
              aria-label="Project name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>

          <div>
            <Caption className="mb-1.5 block">
              Project Location
            </Caption>
            <div className="flex gap-2">
              <Input
                type="text"
                value={parentPath}
                onChange={(e) => setParentPath(e.target.value)}
                placeholder="Desktop (default)"
                aria-label="Project location"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
              />
              <Button
                variant="secondary"
                onClick={handleBrowse}
                disabled={!nativeDialogs || isCreating}
                tooltip={nativeDialogs ? undefined : "Type a path on the backend"}
                className="shrink-0 rounded-xl"
              >
                Browse
              </Button>
            </div>
            <Caption className="mt-1.5 block break-all">
              Will be created at{" "}
              {parentPath.trim()
                ? `${parentPath.trim()}/${trimmed || "<name>"}`
                : `~/Desktop/${trimmed || "<name>"}`}{" "}
              on the main branch.
            </Caption>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <Button
            className="flex-1"
            variant="primary"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            variant="submit"
            onClick={handleSubmit}
            disabled={isCreating || isInvalid}
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
