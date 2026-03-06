import { createPortal } from "react-dom";
import { Text, Muted, Button } from "@/components/ui";

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

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-primary-950/60" role="presentation" onClick={onCancel} />
      <div className="relative w-full max-w-md glass-morphism rounded-2xl overflow-hidden">
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
    </div>,
    document.body,
  );
}
