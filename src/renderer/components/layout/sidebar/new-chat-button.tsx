import { Plus } from "@/components/ui/icons";
import { Body, Caption } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface NewChatButtonProps {
  onClick: () => void;
}

export default function NewChatButton({ onClick }: NewChatButtonProps) {
  return (
    <Button
      variant="subtle"
      size="md"
      onClick={onClick}
      fullWidth
      className="justify-start"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <Plus className="w-4 h-4 text-primary-600 dark:text-primary-400" />
      <Body className="text-primary-900 dark:text-primary-100 font-medium">
        New chat
      </Body>
      <Caption className="ml-auto text-primary-500 dark:text-primary-400">
        ⌘ N
      </Caption>
    </Button>
  );
}
