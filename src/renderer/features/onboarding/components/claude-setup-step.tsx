import { CliSetupStep } from "./cli-setup-step";

export function ClaudeSetupStep() {
  return (
    <CliSetupStep
      intro="Mains uses Claude CLI to power its AI coding agent. Make sure you have the CLI installed and authenticated before using the Claude."
      sections={[
        {
          label: "Install & authenticate:",
          commands: [
            "npm install -g @anthropic-ai/claude-code",
            "claude /login",
          ],
        },
      ]}
      helpLinkUrl="https://docs.anthropic.com/en/docs/claude-code"
      helpLinkLabel="Anthropic setup guide"
      showBack={false}
    />
  );
}
