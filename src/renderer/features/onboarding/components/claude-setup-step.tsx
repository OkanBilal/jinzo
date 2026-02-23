import Text from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useWizard } from "@/components/ui/wizard-modal";

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

      <div className="space-y-3 rounded-2xl bg-primary-100/50 dark:bg-primary-900/30 p-4">
        <Text variant="label">Install & authenticate:</Text>
        <code className="block rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 py-2 text-sm font-mono text-primary-800 dark:text-primary-200">
          npm install -g @anthropic-ai/claude-code
        </code>
        <code className="block rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 py-2 text-sm font-mono text-primary-800 dark:text-primary-200">
          claude /login
        </code>
      </div>

      <Text variant="mutedSmall">
        Need help?{" "}
        <a
          href="https://docs.anthropic.com/en/docs/claude-code"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 dark:text-primary-400 underline"
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
