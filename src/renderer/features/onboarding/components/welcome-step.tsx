import Text from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useWizard } from "@/components/ui/wizard-modal";

export function WelcomeStep() {
  const { goBack, close } = useWizard();

  return (
    <div className="space-y-4">
      <Text variant="h2">Welcome to Jinzo</Text>
      <Text variant="muted">
        Your AI-powered workspace for coding, research, and productivity.
        Connect your tools, manage tasks, and let AI agents help you build
        faster.
      </Text>

      <div className="space-y-2 rounded-2xl bg-primary-100/50 dark:bg-primary-900/30 p-4">
        <Text variant="bodySmall">
          <strong>Workspaces</strong> — Link local repos and run AI coding agents
        </Text>
        <Text variant="bodySmall">
          <strong>Connections</strong> — Sync GitHub, Linear, Jira, and more
        </Text>
        <Text variant="bodySmall">
          <strong>Chat</strong> — RAG-powered conversations with your data
        </Text>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={goBack}>
          Back
        </Button>
        <Button variant="submit" size="sm" onClick={close}>
          Get Started
        </Button>
      </div>
    </div>
  );
}
