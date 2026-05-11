import { Check, Clipboard } from "@/components/ui/icons";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Button } from "./button";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const { copy, isCopied } = useCopyToClipboard();
  return (
    <Button
      variant="icon"
      tooltip="Copy to clipboard"
      onClick={() => copy(text)}
      className="shrink-0"
    >
      {isCopied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
    </Button>
  );
}
