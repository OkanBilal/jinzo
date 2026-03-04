import { useEffect } from "react";
import { useAutoUpdate } from "@/hooks/use-auto-update";
import { Button } from "@/components/ui/button";
import { Sparkles, Restart } from "@/components/ui/icons";

export function UpdateBanner() {
  const { state, check, download, install } = useAutoUpdate();

  // Check for updates on mount
  useEffect(() => {
    check();
  }, [check]);

  // Don't show banner for idle/checking/not-available/error
  if (
    state.status === "idle" ||
    state.status === "checking" ||
    state.status === "not-available" ||
    state.status === "error"
  ) {
    return null;
  }

  return (
    <div className="mx-3 mb-2 rounded-xl bg-primary-100/80 dark:bg-primary-800/40 border border-primary-200/60 dark:border-primary-700/40 overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-xs font-medium text-primary-700 dark:text-primary-200 text-center">
          {state.status === "available" && `v${state.info?.version} available`}
          {state.status === "downloading" && "Downloading update..."}
          {state.status === "downloaded" && "Update ready"}
        </p>

        {state.status === "downloading" && state.progress && (
          <div className="w-full h-1.5 rounded-full bg-primary-200 dark:bg-primary-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary-600 dark:bg-primary-300 transition-all duration-300"
              style={{ width: `${Math.round(state.progress.percent)}%` }}
            />
          </div>
        )}

        {state.status === "available" && (
          <Button
            variant="secondary"
            size="xs"
            fullWidth
            leftIcon={
              <Sparkles className="size-3.5" />
            }
            onClick={download}
          >
            Download
          </Button>
        )}

        {state.status === "downloaded" && (
          <Button
            variant="secondary"
            size="xs"
            fullWidth
            leftIcon={
              <Restart className="size-3.5" />
            }
            onClick={install}
          >
            Restart & Update
          </Button>
        )}
      </div>
    </div>
  );
}
