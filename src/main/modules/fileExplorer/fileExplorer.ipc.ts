import { ipcMain } from "../../ipc-kit/ipc-main";
import { handle } from "../../ipc-kit/handle";
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
  ipcMain.handle(
    CHANNELS.fileExplorer.readDirectory,
    handle((options: ReadDirectoryOptions) => fileExplorerService.readDirectory(options)),
  );

  ipcMain.handle(
    CHANNELS.fileExplorer.readDirectoryShallow,
    handle((dirPath: string, options?: { includeHidden?: boolean; excludePatterns?: string[] }) => fileExplorerService.readDirectoryShallow(dirPath, options)),
  );

  ipcMain.handle(
    CHANNELS.fileExplorer.getPathInfo,
    handle((targetPath: string) => fileExplorerService.getPathInfo(targetPath)),
  );

  ipcMain.handle(
    CHANNELS.fileExplorer.readFile,
    handle((filePath: string) => fileExplorerService.readFile(filePath)),
  );

  ipcMain.handle(
    CHANNELS.fileExplorer.readFileText,
    handle((options: ReadFileTextOptions) => fileExplorerService.readFileText(options)),
  );

  ipcMain.handle(
    CHANNELS.fileExplorer.listDir,
    handle((options: ListDirOptions) => fileExplorerService.listDir(options)),
  );

  ipcMain.handle(
    CHANNELS.fileExplorer.searchFiles,
    handle((options: SearchFilesOptions) => fileExplorerService.searchFiles(options)),
  );
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
