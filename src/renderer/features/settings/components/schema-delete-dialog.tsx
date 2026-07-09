import { Muted, Button, Body } from "@/components/ui";

interface SchemaDeleteDialogProps {
  schemaName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SchemaDeleteDialog({
  schemaName,
  onCancel,
  onConfirm,
}: SchemaDeleteDialogProps) {
  return (
    <div className="absolute inset-0 z-(--z-overlay) flex items-center justify-center rounded-3xl backdrop-blur-xs bg-primary-950/50">
      <div className="glass-morphism min-w-md rounded-3xl px-6 py-10 space-y-3 animate-dropdown-in ">
        <Body className="font-medium">Delete schema?</Body>
        <Muted className="mb-6">
          &ldquo;{schemaName}&rdquo; will be permanently removed.
        </Muted>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
