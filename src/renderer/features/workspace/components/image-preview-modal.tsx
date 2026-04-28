import { useEffect, useRef } from "react";
import { Close } from "@/components/ui/icons";

interface ImagePreviewModalProps {
  name: string;
  src: string;
  onClose: () => void;
}

export function ImagePreviewModal({ name, src, onClose }: ImagePreviewModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative flex flex-col glass-morphism rounded-xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary-200 dark:border-primary-800">
          <span className="text-xs font-mono text-primary-600 dark:text-primary-400 truncate">
            {name}
          </span>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 p-1 rounded-md hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
          >
            <Close className="w-3.5 h-3.5 text-primary-500" />
          </button>
        </div>
        <div className="bg-primary-100 dark:bg-primary-900 flex items-center justify-center p-2">
          <img
            src={src}
            alt={name}
            className="max-h-[70vh] max-w-full object-contain rounded"
          />
        </div>
      </div>
    </div>
  );
}
