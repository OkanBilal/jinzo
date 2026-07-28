import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Caption, Button, Body } from "@/components/ui";
import { useCapabilities } from "@/lib/platform";

interface CloneRepoModalProps {
  isOpen: boolean;
  isCloning: boolean;
  onClone: (url: string, targetPath: string) => void;
  onClose: () => void;
}

export default function CloneRepoModal({
  isOpen,
  isCloning,
  onClone,
  onClose,
}: CloneRepoModalProps) {
  const { nativeDialogs } = useCapabilities();
  const [url, setUrl] = useState("");
  const [clonePath, setClonePath] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setUrl("");
    // On web there's no local homedir; let the user type a backend path.
    setClonePath(
      nativeDialogs ? `${window.api.platform.homedir}/Desktop` : "",
    );
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

  const handleBrowse = async () => {
    try {
      const result = await window.api.workspace.selectDirectory();
      if (result?.success && result.data) {
        setClonePath(result.data);
      }
    } catch {
      // User cancelled
    }
  };

  const handleSubmit = () => {
    if (!url.trim() || !clonePath.trim()) return;
    onClone(url.trim(), clonePath.trim());
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
          Clone Repository
        </Body>

        <div className="space-y-4">
          {/* Git URL */}
          <div>
            <Caption className="mb-1.5 block">
              Git URL
            </Caption>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              className="w-full px-3 py-2 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 text-primary-900 dark:text-primary-100 text-sm glass-input outline-none transition-colors placeholder:text-primary-400 dark:placeholder:text-primary-600"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>

          {/* Clone Location */}
          <div>
            <Caption className="mb-1.5 block">
              Clone Location
            </Caption>
            <div className="flex gap-2">
              <input
                type="text"
                value={clonePath}
                onChange={(e) => setClonePath(e.target.value)}
                placeholder="/path/to/directory"
                className="flex-1 px-3 py-2 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 text-primary-900 dark:text-primary-100 text-sm glass-input outline-none transition-colors placeholder:text-primary-400 dark:placeholder:text-primary-600"
              />
              <Button
                variant="primary"
                onClick={handleBrowse}
                disabled={!nativeDialogs}
                tooltip={nativeDialogs ? undefined : "Type a path on the backend"}
                className="shrink-0 rounded-xl"
              >
                Browse
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <Button
            className="flex-1"
            variant="secondary"
            onClick={onClose}
            disabled={isCloning}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 "
            variant="submit"
            onClick={handleSubmit}
            disabled={isCloning || !url.trim() || !clonePath.trim()}
          >
            {isCloning ? "Cloning..." : "Clone"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
