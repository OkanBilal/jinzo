import { Alert } from "@/components/ui";
import type { Space } from "@/lib/redux/api";

interface DeleteSpaceModalProps {
  space: Space | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteSpaceModal({
  space,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteSpaceModalProps) {
  return (
    <Alert
      isOpen={!!space}
      title="Delete Space"
      description={`Are you sure you want to delete "${space?.name}"? This action cannot be undone.`}
      primaryButtonText="Delete"
      secondaryButtonText="Cancel"
      onPrimary={onConfirm}
      onSecondary={onCancel}
      isPrimaryLoading={isDeleting}
      primaryButtonVariant="danger"
    />
  );
}
