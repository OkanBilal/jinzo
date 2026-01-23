import Text, { Muted } from "../../../../../components/ui/text";
import { Button } from "../../../../../components/ui/button";

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
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 "
        onClick={onCancel}
      />
      <div className="relative z-70 w-full max-w-md bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-6">
          <Text variant="h3" className="mb-3">
            Revoke {appName} Access?
          </Text>
          <Muted className="mb-6">{description || defaultDescription}</Muted>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              disabled={loading}
              isLoading={loading}
            >
              {loading ? "Revoking..." : "Revoke Access"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
