import { ipcMain } from "electron";
import { fileExplorerService } from "./fileExplorer.service";
import type {
  ReadDirectoryOptions,
  ReadFileTextOptions,
  ListDirOptions,
  SearchFilesOptions,
} from "./fileExplorer.dto";

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
  SEARCH_FILES: "fileExplorer:searchFiles",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerFileExplorerIpc(): void {
  ipcMain.handle(CHANNELS.READ_DIRECTORY, async (_, options: ReadDirectoryOptions) => {
    return fileExplorerService.readDirectory(options);
  });

  ipcMain.handle(
    CHANNELS.READ_DIRECTORY_SHALLOW,
    async (
      _,
      dirPath: string,
      options?: { includeHidden?: boolean; excludePatterns?: string[] }
    ) => {
      return fileExplorerService.readDirectoryShallow(dirPath, options);
    }
  );

  ipcMain.handle(CHANNELS.GET_PATH_INFO, async (_, targetPath: string) => {
    return fileExplorerService.getPathInfo(targetPath);
  });

  ipcMain.handle(CHANNELS.READ_FILE, async (_, filePath: string) => {
    return fileExplorerService.readFile(filePath);
  });

  ipcMain.handle(CHANNELS.READ_FILE_TEXT, async (_, options: ReadFileTextOptions) => {
    return fileExplorerService.readFileText(options);
  });

  ipcMain.handle(CHANNELS.LIST_DIR, async (_, options: ListDirOptions) => {
    return fileExplorerService.listDir(options);
  });

  ipcMain.handle(CHANNELS.SEARCH_FILES, async (_, options: SearchFilesOptions) => {
    return fileExplorerService.searchFiles(options);
  });
}

export function unregisterFileExplorerIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
