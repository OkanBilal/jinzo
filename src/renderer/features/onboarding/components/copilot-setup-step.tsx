import Text from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useWizard } from "@/components/ui/wizard-modal";

export function CopilotSetupStep() {
  const { goNext, goBack } = useWizard();

  return (
    <div className="space-y-4">
      <Text variant="h2">GitHub Copilot Setup</Text>
      <Text variant="muted">
        Jinzo can also use GitHub Copilot CLI as an AI coding agent. You need an
        active Copilot subscription and the GitHub CLI authenticated.
      </Text>

      <div className="space-y-3 rounded-2xl bg-primary-100/50 dark:bg-primary-900/30 p-4">
        <Text variant="label">Check authentication:</Text>
        <code className="block rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 py-2 text-sm font-mono text-primary-800 dark:text-primary-200">
          gh auth status
        </code>
        <Text variant="label">If not authenticated:</Text>
        <code className="block rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 py-2 text-sm font-mono text-primary-800 dark:text-primary-200">
          gh auth login
        </code>
      </div>

      <Text variant="mutedSmall">
        Requires an active{" "}
        <a
          href="https://github.com/features/copilot"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 dark:text-primary-400 underline"
        >
          GitHub Copilot subscription
        </a>
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
