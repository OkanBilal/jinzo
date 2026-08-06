import { Button } from "@/components/ui";
import {
  getProviderVariant,
  type ProviderVariant,
} from "@/lib/provider-variants";
import { useBottomTerminal } from "@/hooks/use-bottom-terminal";

interface ProviderAuthNoticeProps {
  variant: ProviderVariant;
  title: string;
  message?: string | null;
  /** Optional re-probe action (e.g. refetch models + account info). */
  onRecheck?: () => void;
  isRechecking?: boolean;
  className?: string;
}

/**
 * Yellow auth notice with a one-click recovery: "Sign in" opens the bottom
 * terminal and runs the variant's `authLoginCommand` (the login flows are
 * interactive, so they live in the terminal rather than a headless spawn).
 * Used above the composer (signed-out preflight) and in the transcript when
 * a run fails with an auth-classified error.
 */
export function ProviderAuthNotice({
  variant,
  title,
  message,
  onRecheck,
  isRechecking = false,
  className = "",
}: ProviderAuthNoticeProps) {
  const { runCommand } = useBottomTerminal();
  const { authLoginCommand } = getProviderVariant(variant);

  return (
    <div
      className={`px-3 py-2.5 mb-2 rounded-2xl text-warning bg-warning/10 dark:bg-warning/10 text-xs flex items-center justify-between gap-3 ${className}`}
    >
      <span className="min-w-0">
        <span className="font-medium">{title}</span>
        {message ? <span className="opacity-80"> — {message}</span> : null}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {onRecheck && (
          <Button
            type="button"
            variant="subtle"
            onClick={onRecheck}
            isLoading={isRechecking}
            className=" glass-outline text-warning hover:text-warning/80 hover:bg-warning/10! transition-colors cursor-pointer"
          >
            Check Auth
          </Button>
        )}
        <Button
          type="button"
          variant="subtle"
          tooltip={`Runs \`${authLoginCommand}\` in the terminal`}
          tooltipPosition="top-left"
          onClick={() => runCommand(authLoginCommand)}
          className=" glass-outline bg-warning/10 text-warning hover:text-warning/80 hover:bg-warning/20! transition-colors cursor-pointer"
        >
          Sign in
        </Button>
      </span>
    </div>
  );
}
