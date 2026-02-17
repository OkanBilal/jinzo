import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useSetActiveMoodMutation,
  useCreateJournalDraftMutation,
  useCreateWorkspaceMutation,
  useSelectDirectoryMutation,
  useGetAccountQuery,
} from "@/lib/redux/api";
import { toast } from "@/components/ui/toast";
import { useActiveMood } from "@/hooks/use-active-mood";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { useRouteType } from "@/hooks/use-route-type";
import { getBaseRoutePath } from "@/lib/route-utils";

export function useSidebarActions() {
  const navigate = useNavigate();
  const routeType = useRouteType();
  const { moods } = useActiveMood();
  const sidebarConfig = useSidebarConfig();
  const { data: account } = useGetAccountQuery();

  const [setActiveMood] = useSetActiveMoodMutation();
  const [createJournalDraft] = useCreateJournalDraftMutation();
  const [createWorkspace] = useCreateWorkspaceMutation();
  const [selectDirectory] = useSelectDirectoryMutation();

  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const handleMoodChange = async (moodId: string) => {
    try {
      // Parse route BEFORE mutation to avoid stale closure issues
      const selectedMood = moods.find((m) => m.id === moodId);
      let defaultRoute = "/";

      if (selectedMood?.uiConfig) {
        try {
          const config = JSON.parse(selectedMood.uiConfig);
          defaultRoute = config.sidebar?.defaultRoute || "/";
        } catch {
          // Keep default "/"
        }
      }

      await setActiveMood(moodId || null).unwrap();

      // Use setTimeout to ensure navigation happens after React reconciliation
      // This fixes packaged version timing issues with HashRouter
      setTimeout(() => {
        navigate(defaultRoute, { replace: true });
      }, 0);
    } catch (error) {
      console.error("Error changing mood:", error);
      toast.error("Failed to change mood");
    }
  };

  const handleAddProject = async () => {
    // Open folder picker and create workspace via worktree import
    try {
      const selectedPath = await selectDirectory().unwrap();
      if (selectedPath) {
        // Extract folder name from path
        const folderName = selectedPath.split("/").pop() || "Untitled";
        const workspaceId = crypto.randomUUID();

        // Try to import as git repo with worktree
        const importResult =
          await window.api.git.importLocalRepo(selectedPath);

        if (!importResult.success || !importResult.data) {
          throw new Error(importResult.error || "Not a git repository");
        }

        const {
          branchName,
          worktreePath,
          worktreeName,
          baseBranch,
          tracking,
          ahead,
          behind,
          originUrl,
        } = importResult.data;

        // Build metadata with existing top-level fields + new worktree info
        const metadata = {
          isGitRepo: true,
          tracking: tracking,
          ahead: ahead,
          behind: behind,
          worktree: {
            enabled: true as const,
            name: worktreeName,
            path: worktreePath,
            sourcePath: selectedPath,
            branch: branchName,
          },
          origin: {
            url: originUrl,
          },
          baseBranch: baseBranch,
        };

        await createWorkspace({
          id: workspaceId,
          accountId: account?.id || "default",
          name: folderName,
          rootPath: worktreePath,
          repoUrl: originUrl || undefined,
          defaultBranch: branchName,
          metadata,
        }).unwrap();

        toast.success("Workspace added");
        const basePath = getBaseRoutePath(
          routeType === "claude" ? "claude" : "copilot",
        );
        navigate(`${basePath}/${workspaceId}`);
      }
    } catch (error) {
      console.error("Failed to create workspace:", error);
      toast.error("Not a valid git repository");
    }
  };

  const handleCloneRepo = async (url: string, targetPath: string) => {
    setIsCloning(true);
    try {
      const cloneResult = await window.api.git.cloneRepo(url, targetPath);

      if (!cloneResult.success || !cloneResult.data) {
        throw new Error(cloneResult.error || "Failed to clone repository");
      }

      const { clonedPath, originUrl } = cloneResult.data;

      // Now import the cloned repo the same way as Add Project
      const importResult = await window.api.git.importLocalRepo(clonedPath);

      if (!importResult.success || !importResult.data) {
        throw new Error(importResult.error || "Failed to import cloned repository");
      }

      const {
        branchName,
        worktreePath,
        worktreeName,
        baseBranch,
        tracking,
        ahead,
        behind,
      } = importResult.data;

      const folderName = clonedPath.split("/").pop() || "Untitled";
      const workspaceId = crypto.randomUUID();

      const metadata = {
        isGitRepo: true,
        tracking: tracking,
        ahead: ahead,
        behind: behind,
        worktree: {
          enabled: true as const,
          name: worktreeName,
          path: worktreePath,
          sourcePath: clonedPath,
          branch: branchName,
        },
        origin: {
          url: originUrl,
        },
        baseBranch: baseBranch,
      };

      await createWorkspace({
        id: workspaceId,
        accountId: account?.id || "default",
        name: folderName,
        rootPath: worktreePath,
        repoUrl: originUrl || undefined,
        defaultBranch: branchName,
        metadata,
      }).unwrap();

      toast.success("Repository cloned and workspace created");
      setIsCloneModalOpen(false);
      const basePath = getBaseRoutePath(
        routeType === "claude" ? "claude" : "copilot",
      );
      navigate(`${basePath}/${workspaceId}`);
    } catch (error) {
      console.error("Failed to clone repository:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to clone repository",
      );
    } finally {
      setIsCloning(false);
    }
  };

  const handleNewClick = async () => {
    if (sidebarConfig.itemType === "post") {
      try {
        const result = await createJournalDraft({
          accountId: account?.id || "default",
        }).unwrap();
        if (result?.id) {
          navigate(`/journal/${result.id}`);
        }
      } catch (error) {
        console.error("Failed to create journal draft:", error);
        toast.error("Failed to create new post");
      }
    } else if (sidebarConfig.itemType === "workspace") {
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

  return {
    handleMoodChange,
    handleNewClick,
    handleAddProject,
    handleCloneRepo,
    handleOpenCloneModal,
    handleCloseCloneModal,
    isCloneModalOpen,
    isCloning,
  };
}
