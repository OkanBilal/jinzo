import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Caption, Button, Body } from "@/components/ui";

interface CreateProjectModalProps {
  isOpen: boolean;
  isCreating: boolean;
  onCreate: (name: string) => void;
  onClose: () => void;
}

const INVALID_NAME = /[\\/:*?"<>|]|^\.+$|^\s|\s$/;

export default function CreateProjectModal({
  isOpen,
  isCreating,
  onCreate,
  onClose,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setName("");
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

  const handleSubmit = () => {
    if (isInvalid) return;
    onCreate(trimmed);
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
        <Body className="mb-2 font-medium">
          Create New Project
        </Body>

        <div className="space-y-4">
          <div>
            <Caption className=" mb-1.5 block">
              Project Name
            </Caption>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-new-project"
              autoFocus
              className="w-full px-3 py-2 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 text-primary-900 dark:text-primary-100 text-sm border border-primary-200/50 dark:border-primary-700/30 outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors placeholder:text-primary-400 dark:placeholder:text-primary-600"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
            <Caption className=" mt-1.5 block">
              Will be created at ~/Desktop/{trimmed || "<name>"} on the main branch.
            </Caption>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <Button
            className="flex-1"
            variant="secondary"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            variant="primary"
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
