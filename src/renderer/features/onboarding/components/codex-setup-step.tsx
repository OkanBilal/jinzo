import { Text, Button, useWizard } from "@/components/ui";
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

export function CodexSetupStep() {
  const { goNext, goBack } = useWizard();

  return (
    <div className="space-y-4">
      <Text variant="h2">Codex Setup</Text>
      <Text variant="muted">
        Jinzo can use OpenAI Codex CLI as an AI coding agent. Make sure you have
        the CLI installed and authenticated before using the Codex workspace.
      </Text>

      <div className="space-y-3 rounded-2xl bg-primary-100/50 dark:bg-primary-900/30 py-4">
        <Text variant="label">Install & authenticate:</Text>
        <div className="flex items-center mt-2 rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 py-2">
          <code className="flex-1 text-sm font-mono text-primary-800 dark:text-primary-200">
            npm install -g @openai/codex
          </code>
          <CopyButton text="npm install -g @openai/codex" />
        </div>
        <div className="flex items-center mt-2 rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 py-2">
          <code className="flex-1 text-sm font-mono text-primary-800 dark:text-primary-200">
            codex /login
          </code>
          <CopyButton text="codex /login" />
        </div>
      </div>

      <Text variant="mutedSmall">
        Need help?{" "}
        <button
          type="button"
          onClick={() => window.api.shell.openExternal("https://developers.openai.com/codex/cli")}
          className="text-primary-600 dark:text-primary-400 underline cursor-pointer"
        >
          Codex CLI Setup Guide
        </button>
      </Text>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={goBack}>
          Back
        </Button>
        <Button variant="submit" size="sm" onClick={goNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
