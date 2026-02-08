import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDeleteWorkspaceMutation } from "@/lib/redux/api";
import { toast } from "@/components/ui/toast";
import { useRouteType } from "@/hooks/use-route-type";
import { getBaseRoutePath } from "@/lib/route-utils";

export function useDeleteWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeType = useRouteType();
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [deleteWorkspace, { isLoading: isDeleting }] = useDeleteWorkspaceMutation();

  const handleDeleteClick = (workspaceId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setWorkspaceToDelete(workspaceId);
  };

  const handleConfirmDelete = async () => {
    if (!workspaceToDelete) return;

    const deletePromise = deleteWorkspace(workspaceToDelete).unwrap();
    toast.promise(deletePromise, {
      loading: "Deleting workspace…",
      success: "Workspace deleted",
      error: "Delete failed",
    });

    try {
      await deletePromise;

      // Navigate away if we were viewing the deleted workspace
      const basePath = getBaseRoutePath(routeType === "claude" ? "claude" : "copilot");
      if (location.pathname === `${basePath}/${workspaceToDelete}`) {
        navigate("/");
      }

      setWorkspaceToDelete(null);
    } catch (error) {
      console.error("Failed to delete workspace:", error);
    }
  };

  const handleCancelDelete = () => {
    setWorkspaceToDelete(null);
  };

  return {
    workspaceToDelete,
    isDeleting,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
  };
}
