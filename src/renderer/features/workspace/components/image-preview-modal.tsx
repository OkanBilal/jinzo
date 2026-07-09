import { Modal, ModalHeader } from "@/components/ui";

interface ImagePreviewModalProps {
  name: string;
  src: string;
  onClose: () => void;
}

export function ImagePreviewModal({ name, src, onClose }: ImagePreviewModalProps) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      backdrop="media"
      className="w-fit min-w-80 max-w-[92vw]"
    >
      <ModalHeader onClose={onClose}>
        <span className="text-xs font-mono text-primary-600 dark:text-primary-400 truncate">
          {name}
        </span>
      </ModalHeader>
      <div className="flex-1 min-h-0 bg-primary-100 dark:bg-primary-900 flex items-center justify-center p-2 overflow-auto">
        <img
          src={src}
          alt={name}
          className="max-h-[80vh] max-w-full object-contain rounded"
        />
      </div>
    </Modal>
  );
}
