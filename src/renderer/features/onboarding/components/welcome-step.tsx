import Text from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useWizard } from "@/components/ui/wizard-modal";

export function WelcomeStep() {
  const { goBack, close } = useWizard();

  return (
    <div className="flex gap-6">
      {/* Left — Illustration */}
      <div className="hidden sm:flex w-48 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary-200/60 to-primary-300/40 dark:from-primary-800/40 dark:to-primary-900/30">
        <div className="flex flex-col items-center gap-3 text-primary-500 dark:text-primary-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-16 h-16"
          >
            <rect x="8" y="4" width="48" height="56" rx="6" />
            <path d="M20 20l8 8-8 8" />
            <line x1="32" y1="36" x2="44" y2="36" />
          </svg>
          <span className="text-xs font-medium tracking-wide uppercase opacity-70">
            Jinzo
          </span>
        </div>
      </div>

      {/* Right — Content */}
      <div className="flex-1 space-y-4">
        <Text variant="h2">Welcome to Jinzo</Text>
        <Text variant="muted">
          Your AI-powered workspace for coding, research, and productivity.
          Connect your tools, manage tasks, and let AI agents help you build
          faster.
        </Text>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={goBack}>
            Back
          </Button>
          <Button variant="submit" size="sm" onClick={close}>
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}
