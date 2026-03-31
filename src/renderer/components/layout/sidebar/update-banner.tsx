import { useState } from "react";
import { useAutoUpdate } from "@/hooks/use-auto-update";
import { Button } from "@/components/ui";
import { Close } from "@/components/ui/icons";
import { AsciiSpinner } from "@/features/workspace/components/ascii-loader";

export function UpdateBanner() {
  const { state, install } = useAutoUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (
    dismissed ||
    state.status === "idle" ||
    state.status === "checking" ||
    state.status === "not-available" ||
    state.status === "error"
  ) {
    return null;
  }

  return (
    <div className="mx-3 mb-2 rounded-xl bg-primary-100/80 dark:bg-primary/5 border border-primary-200/60 dark:border-primary/10 overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div />
          <p className="text-xs font-medium text-primary-700 dark:text-primary-200">
            {(state.status === "available" ||
              state.status === "downloading") && (
              <>
                <AsciiSpinner variant="null" />
                {` Downloading update${state.info?.version ? ` ${state.info.version}` : ""}`}
              </>
            )}
            {state.status === "downloaded" &&
              (state.info?.version
                ? `${state.info.version} ready`
                : "Update ready")}
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-0.5 rounded-md hover:bg-primary-200/50 dark:hover:bg-primary/10 transition-colors text-primary-500 dark:text-primary-400 cursor-pointer"
          >
            <Close className="size-3" />
          </button>
        </div>

        {state.status === "downloaded" && (
          <Button variant="secondary" size="xs" fullWidth onClick={install}>
            Restart & Update
          </Button>
        )}
      </div>
    </div>
  );
}
