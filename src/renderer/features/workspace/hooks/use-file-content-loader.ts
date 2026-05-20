import { useEffect } from "react";
import { useDispatch } from "react-redux";
import {
  setSelectedFileContent,
  setFileContentLoading,
  setFileContentError,
} from "@/lib/redux/slices/workspaceSlice";
import type {
  FileContentResponse,
  ServiceResponse,
} from "@/features/workspace/types/file-explorer";

interface SelectedFile {
  type: string;
  fullPath: string;
  extension?: string;
  name?: string;
}

export function useFileContentLoader(
  selectedFile: SelectedFile | null,
  rootPath: string | undefined,
) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (
      !selectedFile ||
      selectedFile.type !== "file" ||
      !rootPath ||
      selectedFile.extension === "diff"
    ) {
      return;
    }

    let cancelled = false;
    const filePath = selectedFile.fullPath;

    async function loadFileContent() {
      dispatch(setFileContentLoading(true));
      dispatch(setFileContentError(null));

      try {
        const result: ServiceResponse<FileContentResponse> =
          await window.api.fileExplorer.readFileText({
            filePath,
          });

        if (cancelled) return;

        if (result.success) {
          dispatch(setSelectedFileContent(result.data));
        } else {
          dispatch(setFileContentError(result.error));
        }
      } catch (err) {
        if (cancelled) return;
        dispatch(
          setFileContentError(
            err instanceof Error ? err.message : "Unknown error",
          ),
        );
      }
    }

    loadFileContent();

    return () => {
      cancelled = true;
    };
  }, [selectedFile, rootPath, dispatch]);
}
