import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Body, Caption } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

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
  const [url, setUrl] = useState("");
  const [clonePath, setClonePath] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setUrl("");
    setClonePath(`${window.api.platform.homedir}/Desktop`);
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
      const result = await window.api.workspaces.selectDirectory();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="rounded-4xl px-6 pt-5 pb-6 glass-morphism max-w-md w-full animate-dropdown-in origin-center"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Body className="text-primary-900 dark:text-primary-100 font-semibold mb-4">
          Clone Repository
        </Body>

        <div className="space-y-4">
          {/* Git URL */}
          <div>
            <Caption className="text-primary-700 dark:text-primary-300 mb-1.5 block font-medium">
              Git URL
            </Caption>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              className="w-full px-3 py-2 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 text-primary-900 dark:text-primary-100 text-sm border border-primary-200/50 dark:border-primary-700/30 outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors placeholder:text-primary-400 dark:placeholder:text-primary-600"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>

          {/* Clone Location */}
          <div>
            <Caption className="text-primary-700 dark:text-primary-300 mb-1.5 block font-medium">
              Clone Location
            </Caption>
            <div className="flex gap-2">
              <input
                type="text"
                value={clonePath}
                onChange={(e) => setClonePath(e.target.value)}
                placeholder="/path/to/directory"
                className="flex-1 px-3 py-2 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 text-primary-900 dark:text-primary-100 text-sm border border-primary-200/50 dark:border-primary-700/30 outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors placeholder:text-primary-400 dark:placeholder:text-primary-600"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBrowse}
                className="shrink-0 rounded-xl!"
              >
                Browse
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <Button
            className="flex-1 rounded-full! font-semibold"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isCloning}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-full! font-semibold"
            variant="primary"
            size="md"
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
