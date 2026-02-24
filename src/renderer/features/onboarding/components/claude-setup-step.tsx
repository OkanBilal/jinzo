import Text from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useWizard } from "@/components/ui/wizard-modal";
import { Check, Clipboard } from "@/components/ui/icons";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

function CopyButton({ text }: { text: string }) {
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

export function ClaudeSetupStep() {
  const { goNext } = useWizard();

  //TODO: Update design and content of onboarding steps

  return (
    <div className="space-y-4">
      <Text variant="h2">Claude Setup</Text>
      <Text variant="muted">
        Jinzo uses Claude CLI to power its AI coding agent. Make sure you
        have the CLI installed and authenticated before using the Claude
        workspace.
      </Text>

      <div className="space-y-3 rounded-2xl bg-primary-100/50 dark:bg-primary-900/30 py-4 ">
        <Text variant="label">Install & authenticate:</Text>
        <div className="flex items-center mt-2 rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 py-2">
          <code className="flex-1 text-sm font-mono text-primary-800 dark:text-primary-200">
            npm install -g @anthropic-ai/claude-code
          </code>
          <CopyButton text="npm install -g @anthropic-ai/claude-code" />
        </div>
        <div className="flex items-center mt-2 rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 py-2">
          <code className="flex-1 text-sm font-mono text-primary-800 dark:text-primary-200">
            claude /login
          </code>
          <CopyButton text="claude /login" />
        </div>
      </div>

      <Text variant="mutedSmall">
        Need help?{" "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.api.shell.openExternal("https://docs.anthropic.com/en/docs/claude-code");
          }}
          className="text-primary-600 dark:text-primary-400 underline cursor-pointer"
        >
          Anthropic setup guide
        </a>
      </Text>

      <div className="flex justify-end pt-2">
        <Button variant="submit" size="sm" onClick={goNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
