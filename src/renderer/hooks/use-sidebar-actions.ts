import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useSetActiveSpaceMutation,
  useCreateJournalDraftMutation,
  useCreateWorkspaceMutation,
  useSelectDirectoryMutation,
  useGetAccountQuery,
  useGetAppSettingsQuery,
  useFindOrCreateProjectMutation,
  useUpdateProjectMutation,
} from "@/lib/redux/api";
import { toast } from "@/components/ui/toast";
import { useActiveSpace } from "@/hooks/use-active-space";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { useRouteType } from "@/hooks/use-route-type";
import { getBaseRoutePath } from "@/lib/route-utils";

export function useSidebarActions() {
  const navigate = useNavigate();
  const routeType = useRouteType();
  const { spaces } = useActiveSpace();
  const sidebarConfig = useSidebarConfig();
  const { data: account } = useGetAccountQuery();
  const { data: appSettings } = useGetAppSettingsQuery();

  const [setActiveSpace] = useSetActiveSpaceMutation();
  const [createJournalDraft] = useCreateJournalDraftMutation();
  const [createWorkspace] = useCreateWorkspaceMutation();
  const [selectDirectory] = useSelectDirectoryMutation();
  const [findOrCreateProject] = useFindOrCreateProjectMutation();
  const [updateProject] = useUpdateProjectMutation();

  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const handleSpaceChange = async (spaceId: string) => {
    try {
      // Parse route BEFORE mutation to avoid stale closure issues
      const selectedSpace = spaces.find((s) => s.id === spaceId);
      let defaultRoute = "/";

      if (selectedSpace?.uiConfig) {
        try {
          const config = JSON.parse(selectedSpace.uiConfig);
          defaultRoute = config.sidebar?.defaultRoute || "/";
        } catch {
          // Keep default "/"
        }
      }

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

  const handleAddProject = async () => {
    // Open folder picker and create workspace via worktree import
    try {
      const selectedPath = await selectDirectory().unwrap();
      if (selectedPath) {
        // Extract folder name from path
        const folderName = selectedPath.split("/").pop() || "Untitled";
        const workspaceId = crypto.randomUUID();
        const useWorktrees = appSettings?.enableWorktrees ?? true;

        if (useWorktrees) {
          // Worktree flow: first get origin, create project, then import with project name

          // 1. Get origin URL before import
          const remotesResult = await window.api.git.getRemotes(selectedPath);
          const originUrl =
            remotesResult?.success && Array.isArray(remotesResult.data)
              ? (remotesResult.data.find((r: any) => r.name === "origin")
                  ?.fetchUrl ?? null)
              : null;

          if (!originUrl) {
            toast.error("Repository must have a remote origin");
            return;
          }

          // 2. Get base branch
          const branchResult =
            await window.api.git.getCurrentBranch(selectedPath);
          const baseBranch =
            branchResult?.success && branchResult.data
              ? branchResult.data
              : "main";

          // 3. Find or create project first so we have the project name
          const projectResult = await findOrCreateProject({
            accountId: account?.id || "default",
            name: folderName,
            rootPath: selectedPath,
            remoteOrigin: originUrl,
            defaultBranch: baseBranch,
          }).unwrap();

          const projectName = projectResult?.name || folderName;

          // 4. Import with project name so worktree lands under worktrees/{projectName}/
          const importResult = await window.api.git.importLocalRepo(
            selectedPath,
            projectName,
          );

          if (!importResult.success || !importResult.data) {
            throw new Error(importResult.error || "Not a git repository");
          }

          const {
            branchName,
            worktreePath,
            worktreeName,
            tracking,
            ahead,
            behind,
          } = importResult.data;

          // 5. Set project workspacesPath if not already set
          if (projectResult && !projectResult.workspacesPath) {
            // worktreePath is like .../worktrees/{projectName}/{fruitName}
            // workspacesPath should be .../worktrees/{projectName}
            const workspacesPath = worktreePath.substring(
              0,
              worktreePath.lastIndexOf("/"),
            );
            await updateProject({
              id: projectResult.id,
              payload: { workspacesPath },
            });
          }

          const metadata = {
            isGitRepo: true,
            tracking,
            ahead,
            behind,
            worktree: {
              enabled: true as const,
              name: worktreeName,
              path: worktreePath,
              sourcePath: selectedPath,
              branch: branchName,
            },
            origin: { url: originUrl },
            baseBranch,
          };

          await createWorkspace({
            id: workspaceId,
            accountId: account?.id || "default",
            name: folderName,
            rootPath: worktreePath,
            repoUrl: originUrl,
            defaultBranch: branchName,
            metadata,
            projectId: projectResult?.id,
          }).unwrap();
        } else {
          // Direct flow: use source path and active branch directly
          const importResult =
            await window.api.git.importLocalRepoDirect(selectedPath);

          if (!importResult.success || !importResult.data) {
            throw new Error(importResult.error || "Not a git repository");
          }

          const {
            branchName,
            baseBranch,
            tracking,
            ahead,
            behind,
            originUrl,
          } = importResult.data;

          // Reject if no remote origin
          if (!originUrl) {
            toast.error("Repository must have a remote origin");
            return;
          }

          // Find or create project for this remote origin
          const projectResult = await findOrCreateProject({
            accountId: account?.id || "default",
            name: folderName,
            rootPath: selectedPath,
            remoteOrigin: originUrl,
            branches: [branchName],
            defaultBranch: baseBranch,
          }).unwrap();

          const metadata = {
            isGitRepo: true,
            tracking,
            ahead,
            behind,
            worktree: { enabled: false as const },
            origin: { url: originUrl },
            baseBranch,
          };

          await createWorkspace({
            id: workspaceId,
            accountId: account?.id || "default",
            name: folderName,
            rootPath: selectedPath,
            repoUrl: originUrl,
            defaultBranch: branchName,
            metadata,
            projectId: projectResult?.id,
          }).unwrap();
        }

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
      const folderName = clonedPath.split("/").pop() || "Untitled";
      const workspaceId = crypto.randomUUID();
      const useWorktrees = appSettings?.enableWorktrees ?? true;

      // Find or create project (originUrl is always available from clone)
      const projectResult = originUrl
        ? await findOrCreateProject({
            accountId: account?.id || "default",
            name: folderName,
            rootPath: clonedPath,
            remoteOrigin: originUrl,
          }).unwrap()
        : null;

      const projectName = projectResult?.name || folderName;

      if (useWorktrees) {
        // Worktree flow — pass projectName so worktree lands under worktrees/{projectName}/
        const importResult = await window.api.git.importLocalRepo(
          clonedPath,
          projectName,
        );

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

        // Set project workspacesPath if not already set
        if (projectResult && !projectResult.workspacesPath) {
          const workspacesPath = worktreePath.substring(
            0,
            worktreePath.lastIndexOf("/"),
          );
          await updateProject({
            id: projectResult.id,
            payload: { workspacesPath },
          });
        }

        const metadata = {
          isGitRepo: true,
          tracking,
          ahead,
          behind,
          worktree: {
            enabled: true as const,
            name: worktreeName,
            path: worktreePath,
            sourcePath: clonedPath,
            branch: branchName,
          },
          origin: { url: originUrl },
          baseBranch,
        };

        await createWorkspace({
          id: workspaceId,
          accountId: account?.id || "default",
          name: folderName,
          rootPath: worktreePath,
          repoUrl: originUrl || undefined,
          defaultBranch: branchName,
          metadata,
          projectId: projectResult?.id,
        }).unwrap();
      } else {
        // Direct flow: use cloned path directly
        const importResult = await window.api.git.importLocalRepoDirect(clonedPath);

        if (!importResult.success || !importResult.data) {
          throw new Error(importResult.error || "Failed to import cloned repository");
        }

        const {
          branchName,
          baseBranch,
          tracking,
          ahead,
          behind,
        } = importResult.data;

        const metadata = {
          isGitRepo: true,
          tracking,
          ahead,
          behind,
          worktree: { enabled: false as const },
          origin: { url: originUrl },
          baseBranch,
        };

        await createWorkspace({
          id: workspaceId,
          accountId: account?.id || "default",
          name: folderName,
          rootPath: clonedPath,
          repoUrl: originUrl || undefined,
          defaultBranch: branchName,
          metadata,
          projectId: projectResult?.id,
        }).unwrap();
      }

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
    handleSpaceChange,
    handleNewClick,
    handleAddProject,
    handleCloneRepo,
    handleOpenCloneModal,
    handleCloseCloneModal,
    isCloneModalOpen,
    isCloning,
  };
}
