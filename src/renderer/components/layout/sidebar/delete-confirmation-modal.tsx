import Alert from "@/components/ui/alert";

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    isDeleting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    description?: string;
}

export default function DeleteConfirmationModal({
    isOpen,
    isDeleting,
    onConfirm,
    onCancel,
    title = "Delete Conversation?",
    description = "This action cannot be undone. The conversation will be permanently deleted.",
}: DeleteConfirmationModalProps) {
    return (
        <Alert
            isOpen={isOpen}
            title={title}
            description={description}
            primaryButtonText="Delete"
            secondaryButtonText="Cancel"
            onPrimary={onConfirm}
            onSecondary={onCancel}
            isPrimaryLoading={isDeleting}
            primaryButtonVariant="danger"
        />
    );
}
