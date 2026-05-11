import { fileExplorerService } from "./fileExplorer.service";
import type {
  ReadDirectoryOptions,
  ReadFileTextOptions,
  ListDirOptions,
  SearchFilesOptions,
} from "./fileExplorer.dto";

// ─────────────────────────────────────────────────────────────
// File Explorer Controller
// ─────────────────────────────────────────────────────────────
export const fileExplorerController = {
  readDirectory: (options: ReadDirectoryOptions) =>
    fileExplorerService.readDirectory(options),

  readDirectoryShallow: (
    dirPath: string,
    options?: { includeHidden?: boolean; excludePatterns?: string[] }
  ) => fileExplorerService.readDirectoryShallow(dirPath, options),

  getPathInfo: (targetPath: string) =>
    fileExplorerService.getPathInfo(targetPath),

  readFile: (filePath: string) =>
    fileExplorerService.readFile(filePath),

  readFileText: (options: ReadFileTextOptions) =>
    fileExplorerService.readFileText(options),

  listDir: (options: ListDirOptions) =>
    fileExplorerService.listDir(options),

  searchFiles: (options: SearchFilesOptions) =>
    fileExplorerService.searchFiles(options),
};
