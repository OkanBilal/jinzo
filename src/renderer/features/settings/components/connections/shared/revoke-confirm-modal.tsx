import { Alert } from "@/components/ui";

interface RevokeConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  appName: string;
  description?: string;
}

export function RevokeConfirmModal({
  onConfirm,
  onCancel,
  loading,
  appName,
  description,
}: RevokeConfirmModalProps) {
  const defaultDescription = `This will disconnect your ${appName} account and remove all associated sources from your feed. This action cannot be undone.`;

  return (
    <Alert
      isOpen
      title={`Revoke ${appName} Access?`}
      description={description || defaultDescription}
      primaryButtonText="Revoke Access"
      secondaryButtonText="Cancel"
      onPrimary={onConfirm}
      onSecondary={onCancel}
      isPrimaryLoading={loading}
    />
  );
}
