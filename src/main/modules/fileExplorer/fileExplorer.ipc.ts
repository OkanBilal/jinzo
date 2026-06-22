import { ipcMain } from "../../ipc-kit/ipc-main";
import { fileExplorerService } from "./fileExplorer.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import type {
  ReadDirectoryOptions,
  ReadFileTextOptions,
  ListDirOptions,
  SearchFilesOptions,
} from "./fileExplorer.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerFileExplorerIpc(): void {
  ipcMain.handle(CHANNELS.fileExplorer.readDirectory, async (_, options: ReadDirectoryOptions) => {
    return fileExplorerService.readDirectory(options);
  });

  ipcMain.handle(
    CHANNELS.fileExplorer.readDirectoryShallow,
    async (
      _,
      dirPath: string,
      options?: { includeHidden?: boolean; excludePatterns?: string[] }
    ) => {
      return fileExplorerService.readDirectoryShallow(dirPath, options);
    }
  );

  ipcMain.handle(CHANNELS.fileExplorer.getPathInfo, async (_, targetPath: string) => {
    return fileExplorerService.getPathInfo(targetPath);
  });

  ipcMain.handle(CHANNELS.fileExplorer.readFile, async (_, filePath: string) => {
    return fileExplorerService.readFile(filePath);
  });

  ipcMain.handle(CHANNELS.fileExplorer.readFileText, async (_, options: ReadFileTextOptions) => {
    return fileExplorerService.readFileText(options);
  });

  ipcMain.handle(CHANNELS.fileExplorer.listDir, async (_, options: ListDirOptions) => {
    return fileExplorerService.listDir(options);
  });

  ipcMain.handle(CHANNELS.fileExplorer.searchFiles, async (_, options: SearchFilesOptions) => {
    return fileExplorerService.searchFiles(options);
  });
}

export function unregisterFileExplorerIpc(): void {
  [
    CHANNELS.fileExplorer.readDirectory,
    CHANNELS.fileExplorer.readDirectoryShallow,
    CHANNELS.fileExplorer.getPathInfo,
    CHANNELS.fileExplorer.readFile,
    CHANNELS.fileExplorer.readFileText,
    CHANNELS.fileExplorer.listDir,
    CHANNELS.fileExplorer.searchFiles,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
