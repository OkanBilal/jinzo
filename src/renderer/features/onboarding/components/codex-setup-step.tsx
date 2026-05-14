import { CliSetupStep } from "./cli-setup-step";

export function CodexSetupStep() {
  return (
    <CliSetupStep
      intro="Mains can use OpenAI Codex CLI as an AI coding agent. Make sure you have the CLI installed and authenticated before using the Codex."
      sections={[
        {
          label: "Install & authenticate:",
          commands: ["npm install -g @openai/codex", "codex /login"],
        },
      ]}
      helpLinkUrl="https://developers.openai.com/codex/cli"
      helpLinkLabel="Codex CLI Setup Guide"
    />
  );
}
