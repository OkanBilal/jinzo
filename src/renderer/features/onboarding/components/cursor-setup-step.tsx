import { CliSetupStep } from "./cli-setup-step";

export function CursorSetupStep() {
  return (
    <CliSetupStep
      intro="Mains can use Cursor Agent CLI as an AI coding agent. Install the CLI and authenticate before using the Cursor."
      sections={[
        {
          label: "Install & authenticate:",
          commands: ["curl https://cursor.com/install -fsS | bash", "agent"],
        },
      ]}
      helpLinkUrl="https://docs.cursor.com/en/cli/overview"
      helpLinkLabel="Cursor CLI Setup Guide"
    />
  );
}
