import { CliSetupStep } from "./cli-setup-step";

export function CopilotSetupStep() {
  return (
    <CliSetupStep
      intro="Mains can use GitHub Copilot as an coding agent. You need an active Copilot subscription and the GitHub CLI authenticated."
      sections={[
        {
          label: "Check authentication:",
          commands: ["gh auth status"],
        },
        {
          label: "If not authenticated:",
          commands: ["gh auth login"],
        },
      ]}
      helpText="Requires an active"
      helpLinkUrl="https://github.com/features/copilot"
      helpLinkLabel="GitHub Copilot subscription"
    />
  );
}
