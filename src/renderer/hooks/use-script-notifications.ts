import { useEffect } from "react";
import { useAppDispatch } from "@/lib/redux/hooks";
import { workspaceApi } from "@/lib/redux/api/workspaceApi";
import { toast } from "@/components/ui";

/**
 * Listens for workspace script completion events from the main process
 * and invalidates the Workspaces cache so the UI refreshes automatically.
 */
export function useScriptNotifications(): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsubscribe = window.api.workspace.onScriptComplete((data) => {
      dispatch(workspaceApi.util.invalidateTags(["Workspaces"]));

      if (!data.success) {
        toast.error(`${data.script === "setup" ? "Setup" : "Archive"} script failed${data.error ? `: ${data.error}` : ""}`);
      }
    });
    return () => { unsubscribe(); };
  }, [dispatch]);
}
