import { useLocation, useNavigate } from "react-router-dom";
import { useArchiveWorkspaceMutation } from "@/lib/redux/api";
import { toast } from "@/components/ui/toast";
import { useRouteType } from "@/hooks/use-route-type";
import { getBaseRoutePath } from "@/lib/route-utils";

export function useArchiveWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeType = useRouteType();
  const [archiveWorkspace, { isLoading: isArchiving }] = useArchiveWorkspaceMutation();

  const handleArchiveClick = async (workspaceId: string) => {
    const archivePromise = archiveWorkspace(workspaceId).unwrap();
    toast.promise(archivePromise, {
      loading: "Archiving workspace…",
      success: "Workspace archived",
      error: "Archive failed",
    });

    try {
      await archivePromise;

      // Navigate away if we were viewing the archived workspace
      const basePath = getBaseRoutePath(routeType === "claude" ? "claude" : "copilot");
      if (location.pathname === `${basePath}/${workspaceId}`) {
        navigate("/");
      }
    } catch (error) {
      console.error("Failed to archive workspace:", error);
    }
  };

  return {
    isArchiving,
    handleArchiveClick,
  };
}
