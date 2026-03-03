import { useEffect } from "react";
import { useAppDispatch } from "@/lib/redux/hooks";
import { workspacesApi } from "@/lib/redux/api/workspacesApi";
import { toast } from "@/components/ui/toast";

/**
 * Listens for workspace script completion events from the main process
 * and invalidates the Workspaces cache so the UI refreshes automatically.
 */
export function useScriptNotifications(): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsubscribe = window.api.workspaces.onScriptComplete((data) => {
      dispatch(workspacesApi.util.invalidateTags(["Workspaces"]));

      if (!data.success) {
        toast.error(`${data.script === "setup" ? "Setup" : "Archive"} script failed${data.error ? `: ${data.error}` : ""}`);
      }
    });
    return () => { unsubscribe(); };
  }, [dispatch]);
}
