import Alert from "@/components/ui/alert";
import type { Mood } from "@/lib/redux/api";

interface DeleteMoodModalProps {
  mood: Mood | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteMoodModal({
  mood,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteMoodModalProps) {
  return (
    <Alert
      isOpen={!!mood}
      title="Delete Mood?"
      description={`Are you sure you want to delete "${mood?.name}"? This action cannot be undone.`}
      primaryButtonText="Delete"
      secondaryButtonText="Cancel"
      onPrimary={onConfirm}
      onSecondary={onCancel}
      isPrimaryLoading={isDeleting}
      primaryButtonVariant="danger"
    />
  );
}
