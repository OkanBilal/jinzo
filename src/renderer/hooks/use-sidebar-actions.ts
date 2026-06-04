import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  useSetActiveSpaceMutation,
  useCreateWorkspaceFromSourceMutation,
  useSelectWorkspaceDirectoryMutation,
  useGetAccountQuery,
} from "@/lib/redux/api";
import { toast } from "@/components/ui";
import { useActiveSpace } from "@/hooks/use-active-space";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import {
  getRouteType,
  getWorkspaceListBasePath,
  getBaseRoutePath,
  getSpaceDefaultRoute,
} from "@/lib/route-utils";

/** Pull a human message out of an RTK/IPC rejection (string | {error} | Error). */
function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "error" in error &&
    typeof (error as { error: unknown }).error === "string"
  ) {
    return (error as { error: string }).error;
  }
  return fallback;
}

export function useSidebarActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { spaces } = useActiveSpace();
  const sidebarConfig = useSidebarConfig();
  const { data: account } = useGetAccountQuery();

  const [setActiveSpace] = useSetActiveSpaceMutation();
  const [selectDirectory] = useSelectWorkspaceDirectoryMutation();
  const [createWorkspaceFromSource] = useCreateWorkspaceFromSourceMutation();

  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleSpaceChange = async (spaceId: string) => {
    try {
      // Parse route BEFORE mutation to avoid stale closure issues
      const selectedSpace = spaces.find((s) => s.id === spaceId);
      const defaultRoute = selectedSpace
        ? getSpaceDefaultRoute(selectedSpace)
        : "/";

      await setActiveSpace(spaceId || null).unwrap();

      // Use setTimeout to ensure navigation happens after React reconciliation
      // This fixes packaged version timing issues with HashRouter
      setTimeout(() => {
        navigate(defaultRoute, { replace: true });
      }, 0);
    } catch (error) {
      console.error("Error changing space:", error);
      toast.error("Failed to change space");
    }
  };

  const goToWorkspace = (workspaceId: string) => {
    const basePath = getWorkspaceListBasePath(
      location.pathname,
      sidebarConfig.defaultRoute,
    );
    navigate(`${basePath}/${workspaceId}`);
  };

  // Pick a folder, then hand it to the main-process workspace intake.
  const handleAddProject = async () => {
    try {
      const selectedPath = await selectDirectory().unwrap();
      if (!selectedPath) return;
      const workspace = await createWorkspaceFromSource({
        accountId: account?.id || "default",
        source: { kind: "folder", path: selectedPath },
      }).unwrap();
      toast.success("Workspace added");
      goToWorkspace(workspace.id);
    } catch (error) {
      console.error("Failed to create workspace:", error);
      toast.error(getErrorMessage(error, "Failed to create workspace"));
    }
  };

  const handleCloneRepo = async (url: string, targetPath: string) => {
    setIsCloning(true);
    try {
      const workspace = await createWorkspaceFromSource({
        accountId: account?.id || "default",
        source: { kind: "clone", url, targetPath },
      }).unwrap();
      toast.success("Repository cloned and workspace created");
      setIsCloneModalOpen(false);
      goToWorkspace(workspace.id);
    } catch (error) {
      console.error("Failed to clone repository:", error);
      toast.error(getErrorMessage(error, "Failed to clone repository"));
    } finally {
      setIsCloning(false);
    }
  };

  const handleNewClick = async () => {
    if (sidebarConfig.itemType === "workspace") {
      // This is now handled by dropdown items, but keep as fallback
      handleAddProject();
    } else {
      navigate(sidebarConfig.defaultRoute);
    }
  };

  const handleOpenCloneModal = () => {
    setIsCloneModalOpen(true);
  };

  const handleCloseCloneModal = () => {
    setIsCloneModalOpen(false);
  };

  const handleOpenCreateProjectModal = () => {
    setIsCreateProjectModalOpen(true);
  };

  const handleCloseCreateProjectModal = () => {
    setIsCreateProjectModalOpen(false);
  };

  const handleCreateProject = async (name: string) => {
    setIsCreatingProject(true);
    try {
      const workspace = await createWorkspaceFromSource({
        accountId: account?.id || "default",
        source: { kind: "init", name },
      }).unwrap();
      toast.success("Project created");
      setIsCreateProjectModalOpen(false);
      const basePath = getBaseRoutePath(getRouteType(location.pathname));
      navigate(`${basePath}/${workspace.id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error(getErrorMessage(error, "Failed to create project"));
    } finally {
      setIsCreatingProject(false);
    }
  };

  return {
    handleSpaceChange,
    handleNewClick,
    handleAddProject,
    handleCloneRepo,
    handleOpenCloneModal,
    handleCloseCloneModal,
    isCloneModalOpen,
    isCloning,
    handleCreateProject,
    handleOpenCreateProjectModal,
    handleCloseCreateProjectModal,
    isCreateProjectModalOpen,
    isCreatingProject,
  };
}
