import { Check, Clipboard } from "@/components/ui/icons";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const { copy, isCopied } = useCopyToClipboard();
  return (
    <button
      onClick={() => copy(text)}
      className="shrink-0 p-1 rounded hover:bg-primary-300/50 dark:hover:bg-primary-700/50 transition-colors text-primary-500 dark:text-primary-400"
      title="Copy to clipboard"
    >
      {isCopied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
    </button>
  );
}
