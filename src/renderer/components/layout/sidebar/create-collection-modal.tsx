import { useId, useRef, useState } from "react";
import { Body, Button, Caption, Input, Modal } from "@/components/ui";

interface CreateCollectionModalProps {
  isOpen: boolean;
  isCreating: boolean;
  onCreate: (name: string) => void;
  onClose: () => void;
}

export default function CreateCollectionModal({
  isOpen,
  isCreating,
  onCreate,
  onClose,
}: CreateCollectionModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setName("");
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  const trimmed = name.trim();
  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      aria-labelledby={titleId}
      initialFocusRef={inputRef}
      closeOnEscape={!isCreating}
      closeOnBackdrop={!isCreating}
      className="max-w-md w-full rounded-4xl px-6 pt-5 pb-6"
    >
      <Body as="h2" id={titleId} weight="medium" className="mb-4">
        Create Project
      </Body>
      <Caption className="mb-1.5 block">Project Name</Caption>
      <Input
        ref={inputRef}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Research"
        aria-label="Project name"
        onKeyDown={(event) => {
          if (event.key === "Enter" && trimmed) onCreate(trimmed);
        }}
      />
      <div className="mt-5 flex gap-3">
        <Button
          className="flex-1"
          variant="primary"
          onClick={onClose}
          disabled={isCreating}
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          variant="submit"
          onClick={() => onCreate(trimmed)}
          disabled={isCreating || !trimmed}
        >
          {isCreating ? "Creating..." : "Create"}
        </Button>
      </div>
    </Modal>
  );
}
