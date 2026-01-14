import Alert from "@/components/ui/alert";

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    isDeleting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function DeleteConfirmationModal({
    isOpen,
    isDeleting,
    onConfirm,
    onCancel,
}: DeleteConfirmationModalProps) {
    return (
        <Alert
            isOpen={isOpen}
            title="Delete Conversation?"
            description="This action cannot be undone. The conversation will be permanently deleted."
            primaryButtonText="Delete"
            secondaryButtonText="Cancel"
            onPrimary={onConfirm}
            onSecondary={onCancel}
            isPrimaryLoading={isDeleting}
            primaryButtonVariant="danger"
        />
    );
}
