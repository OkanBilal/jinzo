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

  const handleMoodChange = async (moodId: string) => {
    try {
      await setActiveMood(moodId || null).unwrap();

      const selectedMood = moods.find((m) => m.id === moodId);
      if (selectedMood?.uiConfig) {
        try {
          const config = JSON.parse(selectedMood.uiConfig);
          const defaultRoute = config.sidebar?.defaultRoute || "/";
          navigate(defaultRoute);
        } catch {
          navigate("/");
        }
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Error changing mood:", error);
      toast.error("Failed to change mood");
    }
  };

  const handleNewClick = async () => {
    if (sidebarConfig.itemType === "post") {
      // Create a new journal draft and navigate to it
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
            // Existing top-level fields (preserved for compatibility)
            isGitRepo: true,
            tracking: tracking,
            ahead: ahead,
            behind: behind,
            // New optional fields for worktree imports
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
            rootPath: worktreePath, // workspace points to worktree
            repoUrl: originUrl || undefined,
            defaultBranch: branchName, // the import branch
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
    } else {
      navigate(sidebarConfig.defaultRoute);
    }
  };

  return {
    handleMoodChange,
    handleNewClick,
  };
}
