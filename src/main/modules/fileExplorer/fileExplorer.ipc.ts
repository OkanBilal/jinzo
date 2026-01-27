import { ipcMain } from "electron";
import { fileExplorerController } from "./fileExplorer.controller";
import type { ReadDirectoryOptions, ReadFileTextOptions, ListDirOptions } from "./fileExplorer.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  READ_DIRECTORY: "fileExplorer:readDirectory",
  READ_DIRECTORY_SHALLOW: "fileExplorer:readDirectoryShallow",
  GET_PATH_INFO: "fileExplorer:getPathInfo",
  READ_FILE: "fileExplorer:readFile",
  READ_FILE_TEXT: "fileExplorer:readFileText",
  LIST_DIR: "fileExplorer:listDir",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerFileExplorerIpc(): void {
  ipcMain.handle(CHANNELS.READ_DIRECTORY, async (_, options: ReadDirectoryOptions) => {
    return fileExplorerController.readDirectory(options);
  });

  ipcMain.handle(
    CHANNELS.READ_DIRECTORY_SHALLOW,
    async (
      _,
      dirPath: string,
      options?: { includeHidden?: boolean; excludePatterns?: string[] }
    ) => {
      return fileExplorerController.readDirectoryShallow(dirPath, options);
    }
  );

  ipcMain.handle(CHANNELS.GET_PATH_INFO, async (_, targetPath: string) => {
    return fileExplorerController.getPathInfo(targetPath);
  });

  ipcMain.handle(CHANNELS.READ_FILE, async (_, filePath: string) => {
    return fileExplorerController.readFile(filePath);
  });

  ipcMain.handle(CHANNELS.READ_FILE_TEXT, async (_, options: ReadFileTextOptions) => {
    return fileExplorerController.readFileText(options);
  });

  ipcMain.handle(CHANNELS.LIST_DIR, async (_, options: ListDirOptions) => {
    return fileExplorerController.listDir(options);
  });
}

export function unregisterFileExplorerIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
