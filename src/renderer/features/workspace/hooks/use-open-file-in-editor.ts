import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  setSelectedFile,
  setActiveTab,
} from "@/lib/redux/slices/workspaceSlice";
import { useGetWorkspaceQuery } from "@/lib/redux/api";
import { appApi } from "@/lib/transport";
import { toast } from "@/components/ui";
import type {
  DirEntry,
  FileNode,
  ServiceResponse,
} from "@/features/workspace/types/file-explorer";

/**
 * Opens a file in the editor tab. Accepts absolute or workspace-relative
 * paths. Agent-written references are unreliable (bare filenames, stale or
 * wrong directory prefixes), so a path that doesn't exist on disk falls back
 * to locating the file in the workspace by basename, preferring the match
 * whose path ends with the referenced relative path.
 */
export function useOpenFileInEditor() {
  const dispatch = useAppDispatch();
  const workspaceId = useAppSelector(
    (s) => s.workspace.activeWorkspaceId,
  );
  const { data: workspace } = useGetWorkspaceQuery(workspaceId || "", {
    skip: !workspaceId,
  });
  const rootPath = workspace?.rootPath;

  return useCallback(
    async (filePath: string) => {
      const trimmed = filePath?.trim();
      if (!trimmed) return;

      const open = (absolutePath: string) => {
        const name = absolutePath.split("/").pop() || absolutePath;
        const dotIdx = name.lastIndexOf(".");
        const extension = dotIdx > 0 ? name.slice(dotIdx + 1) : undefined;
        const node: FileNode = {
          name,
          fullPath: absolutePath,
          type: "file",
          extension,
        };
        dispatch(setSelectedFile(node));
        dispatch(setActiveTab("editor"));
      };

      const fileExists = async (p: string): Promise<boolean> => {
        try {
          const res = await appApi.fileExplorer.getPathInfo(p);
          return res.success && res.data.isFile;
        } catch {
          return false;
        }
      };

      // 1. Direct resolution — absolute as-is, relative against the root.
      const cleaned = trimmed.replace(/^\.\//, "");
      const direct = trimmed.startsWith("/")
        ? trimmed
        : rootPath
          ? `${rootPath.replace(/\/$/, "")}/${cleaned}`
          : null;
      if (direct && (await fileExists(direct))) {
        open(direct);
        return;
      }

      // 2. Locate by basename anywhere in the workspace.
      if (!rootPath) return;
      const basename = cleaned.split("/").pop() ?? cleaned;
      try {
        const result: ServiceResponse<DirEntry[]> =
          await appApi.fileExplorer.searchFiles({
            rootPath,
            query: basename,
            max: 50,
          });
        if (result.success) {
          const candidates = result.data.filter((e) => e.name === basename);
          const best =
            candidates.find((e) => e.fullPath.endsWith(`/${cleaned}`)) ??
            candidates[0];
          if (best) {
            open(best.fullPath);
            return;
          }
        }
      } catch {
        // Search failure falls through to the not-found toast.
      }

      toast.error(`File not found: ${basename}`);
    },
    [dispatch, rootPath],
  );
}
