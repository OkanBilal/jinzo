import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setSelectedFile,
  setActiveTab,
} from "@/lib/redux/slices/workspaceSlice";
import { useGetWorkspaceQuery } from "@/lib/redux/api";
import type { RootState } from "@/lib/redux";
import type { FileNode } from "@/features/workspace/types/file-explorer";

/** Opens a file in the editor tab. Accepts absolute or workspace-relative paths. */
export function useOpenFileInEditor() {
  const dispatch = useDispatch();
  const workspaceId = useSelector(
    (s: RootState) => s.workspace.activeWorkspaceId,
  );
  const { data: workspace } = useGetWorkspaceQuery(workspaceId || "", {
    skip: !workspaceId,
  });
  const rootPath = workspace?.rootPath;

  return useCallback(
    (filePath: string) => {
      if (!filePath) return;
      const trimmed = filePath.trim();
      if (!trimmed) return;

      let absolutePath = trimmed;
      if (!trimmed.startsWith("/")) {
        if (!rootPath) return;
        const cleaned = trimmed.replace(/^\.\//, "");
        absolutePath = `${rootPath.replace(/\/$/, "")}/${cleaned}`;
      }

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
    },
    [dispatch, rootPath],
  );
}
