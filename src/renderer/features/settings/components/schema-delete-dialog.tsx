import { Body, Muted, Button } from "@/components/ui";

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
    <div className="absolute inset-0 z-(--z-overlay) flex items-center justify-center rounded-3xl ">
      <div className="glass-morphism min-w-md rounded-3xl px-6 py-10 space-y-3 animate-dropdown-in ">
        <Body className="font-medium">Delete schema?</Body>
        <Muted className="text-sm mb-6">
          &ldquo;{schemaName}&rdquo; will be permanently removed.
        </Muted>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="submit"
            size="sm"
            onClick={onConfirm}
            className="bg-red-600! hover:bg-red-700! text-primary!"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
