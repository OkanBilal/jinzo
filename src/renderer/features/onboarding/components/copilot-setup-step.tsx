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

export function CopilotSetupStep() {
  const { goNext, goBack } = useWizard();

  return (
    <div className="space-y-4">
      <Text variant="h2">GitHub Copilot Setup</Text>
      <Text variant="muted">
        Mains can use GitHub Copilot as an coding agent. You need an
        active Copilot subscription and the GitHub CLI authenticated.
      </Text>

      <div className="space-y-3 rounded-2xl bg-primary-100/50 dark:bg-primary-900 py-4">
        <Text variant="label">Check authentication:</Text>
        <div className="flex items-center rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 mt-2 py-2">
          <code className="flex-1 text-sm font-mono text-primary-800 dark:text-primary-200">
            gh auth status
          </code>
          <CopyButton text="gh auth status" />
        </div>
        <Text variant="label">If not authenticated:</Text>
        <div className="flex items-center rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 mt-2 py-2">
          <code className="flex-1 text-sm font-mono text-primary-800 dark:text-primary-200">
            gh auth login
          </code>
          <CopyButton text="gh auth login" />
        </div>
      </div>

      <Text variant="mutedSmall">
        Requires an active{" "}
        <button
          type="button"
          onClick={() => window.api.shell.openExternal("https://github.com/features/copilot")}
          className="text-primary-600 dark:text-primary-400 underline cursor-pointer"
        >
          GitHub Copilot subscription
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
