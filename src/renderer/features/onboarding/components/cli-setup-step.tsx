import { Fragment } from "react";
import { Button, useWizard, Muted, Label } from "@/components/ui";
import { CopyButton } from "@/components/ui/copy-button";
import { MutedSmall } from "@/components/ui/text";

interface CommandSection {
  label: string;
  commands: string[];
}

interface CliSetupStepProps {
  intro: string;
  sections: CommandSection[];
  helpText?: string;
  helpLinkUrl: string;
  helpLinkLabel: string;
  showBack?: boolean;
}

export function CliSetupStep({
  intro,
  sections,
  helpText = "Need help?",
  helpLinkUrl,
  helpLinkLabel,
  showBack = true,
}: CliSetupStepProps) {
  const { goNext, goBack } = useWizard();

  return (
    <div className="space-y-4">
      <Muted>{intro}</Muted>

      <div className="space-y-2 rounded-2xl bg-primary-100/50 dark:bg-primary-900 py-4">
        {sections.map((section) => (
          <Fragment key={section.label}>
            <Label>{section.label}</Label>
            {section.commands.map((command) => (
              <div
                key={command}
                className="flex items-center rounded-lg bg-primary-200/60 dark:bg-primary-800/40 px-3 py-2"
              >
                <code className="flex-1 text-sm font-mono text-primary-800 dark:text-primary-200">
                  {command}
                </code>
                <CopyButton text={command} />
              </div>
            ))}
          </Fragment>
        ))}
      </div>

      <MutedSmall>
        {helpText}{" "}
        <Button
          type="button"
          onClick={() => window.api.shell.openExternal(helpLinkUrl)}
          className="text-primary-600 dark:text-primary-400 underline cursor-pointer"
        >
          {helpLinkLabel}
        </Button>
      </MutedSmall>

      <div className={`flex ${showBack ? "justify-between" : "justify-end"} pt-2`}>
        {showBack && (
          <Button variant="ghost" size="sm" onClick={goBack}>
            Back
          </Button>
        )}
        <Button variant="submit" size="sm" onClick={goNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
