import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  useSetActiveSpaceMutation,
  useCreateWorkspaceMutation,
  useSelectDirectoryMutation,
  useGetAccountQuery,
  useGetAppSettingsQuery,
  useFindOrCreateProjectMutation,
  useUpdateProjectMutation,
} from "@/lib/redux/api";
import { toast } from "@/components/ui";
import { useActiveSpace } from "@/hooks/use-active-space";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { getRouteType, getWorkspaceListBasePath } from "@/lib/route-utils";
import { getBaseRoutePath } from "@/lib/route-utils";

export function useSidebarActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { spaces } = useActiveSpace();
  const sidebarConfig = useSidebarConfig();
  const { data: account } = useGetAccountQuery();
  const { data: appSettings } = useGetAppSettingsQuery();

  const [setActiveSpace] = useSetActiveSpaceMutation();
  const [createWorkspace] = useCreateWorkspaceMutation();
  const [selectDirectory] = useSelectDirectoryMutation();
  const [findOrCreateProject] = useFindOrCreateProjectMutation();
  const [updateProject] = useUpdateProjectMutation();

  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

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

          // 2. Get base branch
          const branchResult =
            await window.api.git.getCurrentBranch(selectedPath);
          const baseBranch =
            branchResult?.success && branchResult.data
              ? branchResult.data
              : "main";

          // 3. Find or create project first so we have the project name.
          // Origin-less repos still get a project record (deduped by rootPath).
          const projectResult = await findOrCreateProject({
            accountId: account?.id || "default",
            name: folderName,
            rootPath: selectedPath,
            remoteOrigin: originUrl ?? undefined,
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
            origin: originUrl ? { url: originUrl } : undefined,
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

          // Find or create project — origin-less repos dedup by rootPath.
          const projectResult = await findOrCreateProject({
            accountId: account?.id || "default",
            name: folderName,
            rootPath: selectedPath,
            remoteOrigin: originUrl ?? undefined,
            branches: [branchName],
            defaultBranch: baseBranch,
          }).unwrap();

          const metadata = {
            isGitRepo: true,
            tracking,
            ahead,
            behind,
            worktree: { enabled: false as const },
            origin: originUrl ? { url: originUrl } : undefined,
            baseBranch,
          };

          await createWorkspace({
            id: workspaceId,
            accountId: account?.id || "default",
            name: folderName,
            rootPath: selectedPath,
            repoUrl: originUrl || undefined,
            defaultBranch: branchName,
            metadata,
            projectId: projectResult?.id,
          }).unwrap();
        }

        toast.success("Workspace added");
        const basePath = getWorkspaceListBasePath(
          location.pathname,
          sidebarConfig.defaultRoute,
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
      const basePath = getWorkspaceListBasePath(
        location.pathname,
        sidebarConfig.defaultRoute,
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
      // Always init under the user's Desktop on the `main` branch — bypasses
      // the worktree config so a brand-new project lives at its real path.
      const initResult = await window.api.git.initRepo(name);
      if (!initResult.success || !initResult.data) {
        throw new Error(initResult.error || "Failed to create project");
      }

      const { rootPath } = initResult.data;
      const workspaceId = crypto.randomUUID();

      // Local-only project — no remoteOrigin yet. findOrCreate now dedups by rootPath
      // when the origin is missing, so this safely creates one project per folder.
      const projectResult = await findOrCreateProject({
        accountId: account?.id || "default",
        name,
        rootPath,
        defaultBranch: "main",
        branches: ["main"],
      }).unwrap();

      const metadata = {
        isGitRepo: true,
        tracking: null,
        ahead: 0,
        behind: 0,
        worktree: { enabled: false as const },
        baseBranch: "main",
      };

      await createWorkspace({
        id: workspaceId,
        accountId: account?.id || "default",
        name,
        rootPath,
        defaultBranch: "main",
        metadata,
        projectId: projectResult?.id,
      }).unwrap();

      toast.success("Project created");
      setIsCreateProjectModalOpen(false);
      const basePath = getBaseRoutePath(getRouteType(location.pathname));
      navigate(`${basePath}/${workspaceId}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create project");
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
