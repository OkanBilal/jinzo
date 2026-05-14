import { promises as fs } from "fs";
import * as path from "path";
import type {
  FileNode,
  ReadDirectoryOptions,
  ServiceResponse,
  FileTreeResponse,
  FileContentResponse,
  ReadFileTextOptions,
  DirEntry,
  ListDirOptions,
  SearchFilesOptions,
} from "./fileExplorer.dto";
import {
  DEFAULT_EXCLUDE_PATTERNS,
  MAX_FILE_SIZE_BYTES,
  MAX_READ_DIRECTORY_NODES,
  DEFAULT_READ_DIRECTORY_DEPTH,
  DEFAULT_SEARCH_FILES_MAX,
} from "./fileExplorer.dto";


// ─────────────────────────────────────────────────────────────
// File Explorer Service
// ─────────────────────────────────────────────────────────────

function shouldExclude(
  name: string,
  excludePatterns: string[],
  includeHidden: boolean
): boolean {
  // Skip hidden files unless explicitly included
  if (!includeHidden && name.startsWith(".")) {
    return true;
  }

  // Check against exclude patterns
  for (const pattern of excludePatterns) {
    // Simple glob matching for now (exact match or extension)
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1);
      if (name.endsWith(ext)) return true;
    } else if (name === pattern) {
      return true;
    }
  }

  return false;
}

function getFileExtension(filename: string): string | undefined {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot > 0) {
    return filename.slice(lastDot + 1).toLowerCase();
  }
  return undefined;
}

async function readDirectoryRecursive(
  dirPath: string,
  options: {
    depth: number;
    currentDepth: number;
    includeHidden: boolean;
    excludePatterns: string[];
    maxNodes: number;
  },
  stats: { files: number; directories: number; truncated: boolean }
): Promise<FileNode[]> {
  const { depth, currentDepth, includeHidden, excludePatterns, maxNodes } =
    options;

  // Check depth limit
  if (depth !== -1 && currentDepth >= depth) {
    return [];
  }

  if (stats.files + stats.directories >= maxNodes) {
    stats.truncated = true;
    return [];
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const children: FileNode[] = [];

    // Sort: directories first, then files, alphabetically
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    for (const entry of sortedEntries) {
      if (stats.files + stats.directories >= maxNodes) {
        stats.truncated = true;
        break;
      }
      const name = entry.name;
      const fullPath = path.join(dirPath, name);

      // Skip excluded files/directories
      if (shouldExclude(name, excludePatterns, includeHidden)) {
        continue;
      }

      if (entry.isDirectory()) {
        stats.directories++;
        const dirChildren = await readDirectoryRecursive(fullPath, {
          ...options,
          currentDepth: currentDepth + 1,
        }, stats);

        children.push({
          name,
          fullPath,
          type: "directory",
          children: dirChildren,
        });
      } else if (entry.isFile()) {
        stats.files++;

        // Get file stats for size and modification time
        let size: number | undefined;
        let modifiedAt: string | undefined;

        try {
          const fileStat = await fs.stat(fullPath);
          size = fileStat.size;
          modifiedAt = fileStat.mtime.toISOString();
        } catch {
          // Ignore stat errors for individual files
        }

        children.push({
          name,
          fullPath,
          type: "file",
          extension: getFileExtension(name),
          size,
          modifiedAt,
        });
      }
    }

    return children;
  } catch (error) {
    // Permission denied or other read errors
    console.warn(`[FileExplorer] Cannot read directory ${dirPath}:`, error);
    return [];
  }
}

export const fileExplorerService = {
  /**
   * Read a directory tree starting from rootPath
   */
  async readDirectory(
    options: ReadDirectoryOptions
  ): Promise<ServiceResponse<FileTreeResponse>> {
    const {
      rootPath,
      // Undefined in callers => apply safe default depth cap.
      depth = DEFAULT_READ_DIRECTORY_DEPTH,
      includeHidden = false,
      excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
    } = options;

    try {
      // Validate root path exists and is a directory
      const rootStat = await fs.stat(rootPath);
      if (!rootStat.isDirectory()) {
        return { success: false, error: "Path is not a directory" };
      }

      const stats = { files: 0, directories: 0, truncated: false };
      const rootName = path.basename(rootPath);

      const children = await readDirectoryRecursive(
        rootPath,
        {
          depth,
          currentDepth: 0,
          includeHidden,
          excludePatterns,
          maxNodes: MAX_READ_DIRECTORY_NODES,
        },
        stats
      );

      if (stats.truncated) {
        console.warn(
          `[FileExplorer] readDirectory truncated at ${MAX_READ_DIRECTORY_NODES} nodes for ${rootPath}`,
        );
      }

      const root: FileNode = {
        name: rootName,
        fullPath: rootPath,
        type: "directory",
        children,
      };

      return {
        success: true,
        data: {
          root,
          totalFiles: stats.files,
          totalDirectories: stats.directories,
        },
      };
    } catch (error) {
      console.error("[FileExplorer] Failed to read directory:", error);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { success: false, error: "Directory does not exist" };
      }
      if ((error as NodeJS.ErrnoException).code === "EACCES") {
        return { success: false, error: "Permission denied" };
      }
      return { success: false, error: "Failed to read directory" };
    }
  },

  /**
   * Read a single directory level (non-recursive) for lazy loading
   */
  async readDirectoryShallow(
    dirPath: string,
    options?: { includeHidden?: boolean; excludePatterns?: string[] }
  ): Promise<ServiceResponse<FileNode[]>> {
    const {
      includeHidden = false,
      excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
    } = options || {};

    try {
      const dirStat = await fs.stat(dirPath);
      if (!dirStat.isDirectory()) {
        return { success: false, error: "Path is not a directory" };
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const children: FileNode[] = [];

      // Sort: directories first, then files, alphabetically
      const sortedEntries = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });

      for (const entry of sortedEntries) {
        const name = entry.name;
        const fullPath = path.join(dirPath, name);

        if (shouldExclude(name, excludePatterns, includeHidden)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Check if directory has children (for expand indicator)
          let hasChildren = false;
          try {
            const subEntries = await fs.readdir(fullPath);
            hasChildren = subEntries.some(
              (e) => !shouldExclude(e, excludePatterns, includeHidden)
            );
          } catch {
            // Can't read - assume it might have children
            hasChildren = true;
          }

          children.push({
            name,
            fullPath,
            type: "directory",
            children: hasChildren ? [] : undefined,
          });
        } else if (entry.isFile()) {
          let size: number | undefined;
          let modifiedAt: string | undefined;

          try {
            const fileStat = await fs.stat(fullPath);
            size = fileStat.size;
            modifiedAt = fileStat.mtime.toISOString();
          } catch {
            // Ignore stat errors
          }

          children.push({
            name,
            fullPath,
            type: "file",
            extension: getFileExtension(name),
            size,
            modifiedAt,
          });
        }
      }

      return { success: true, data: children };
    } catch (error) {
      console.error("[FileExplorer] Failed to read directory shallow:", error);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { success: false, error: "Directory does not exist" };
      }
      if ((error as NodeJS.ErrnoException).code === "EACCES") {
        return { success: false, error: "Permission denied" };
      }
      return { success: false, error: "Failed to read directory" };
    }
  },

  /**
   * Check if a path exists and get basic info
   */
  async getPathInfo(
    targetPath: string
  ): Promise<ServiceResponse<{ exists: boolean; isDirectory: boolean; isFile: boolean }>> {
    try {
      const stat = await fs.stat(targetPath);
      return {
        success: true,
        data: {
          exists: true,
          isDirectory: stat.isDirectory(),
          isFile: stat.isFile(),
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          success: true,
          data: { exists: false, isDirectory: false, isFile: false },
        };
      }
      return { success: false, error: "Failed to get path info" };
    }
  },

  /**
   * Read file content (basic, no security checks - use readFileText for secure reads)
   */
  async readFile(filePath: string): Promise<ServiceResponse<string>> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return { success: true, data: content };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { success: false, error: "File does not exist" };
      }
      console.error("[FileExplorer] Failed to read file:", error);
      if ((error as NodeJS.ErrnoException).code === "EACCES") {
        return { success: false, error: "Permission denied" };
      }
      return { success: false, error: "Failed to read file" };
    }
  },

  /**
   * Read file text with full security validation:
   * - Validates path is within workspace root
   * - Resolves realpath to prevent symlink escapes
   * - Blocks path traversal attempts
   * - Only allows regular files (not directories, devices, etc.)
   * - Enforces file size limit
   * - Handles binary/non-UTF8 content
   */
  async readFileText(
    options: ReadFileTextOptions
  ): Promise<ServiceResponse<FileContentResponse>> {
    const {
      filePath,
      workspaceRoot,
      maxSizeBytes = MAX_FILE_SIZE_BYTES,
    } = options;

    try {
      // 1. Normalize and validate paths
      const normalizedRoot = path.resolve(workspaceRoot);
      const normalizedPath = path.resolve(filePath);

      // 2. Check for path traversal attempts (before resolving symlinks)
      if (!normalizedPath.startsWith(normalizedRoot + path.sep) &&
          normalizedPath !== normalizedRoot) {
        console.warn(
          `[FileExplorer] Path traversal blocked: ${filePath} outside ${workspaceRoot}`
        );
        return {
          success: false,
          error: "Access denied: path is outside workspace",
        };
      }

      // 3. Resolve realpath to follow symlinks and check the actual location
      let realPath: string;
      try {
        realPath = await fs.realpath(normalizedPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return { success: false, error: "File does not exist" };
        }
        throw error;
      }

      // 4. Validate realpath is still within workspace (prevent symlink escapes)
      const realRoot = await fs.realpath(normalizedRoot).catch(() => normalizedRoot);
      if (!realPath.startsWith(realRoot + path.sep) && realPath !== realRoot) {
        console.warn(
          `[FileExplorer] Symlink escape blocked: ${filePath} resolves to ${realPath} outside ${realRoot}`
        );
        return {
          success: false,
          error: "Access denied: symlink points outside workspace",
        };
      }

      // 5. Get file stats and validate it's a regular file
      const stats = await fs.lstat(realPath);

      if (!stats.isFile()) {
        if (stats.isDirectory()) {
          return { success: false, error: "Cannot read directory as file" };
        }
        if (stats.isSymbolicLink()) {
          // Should not reach here after realpath, but safety check
          return { success: false, error: "Cannot read symbolic link" };
        }
        return { success: false, error: "Cannot read non-regular file" };
      }

      // 6. Check file size
      if (stats.size > maxSizeBytes) {
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const limitMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
        return {
          success: false,
          error: `File too large (${sizeMB}MB). Maximum size is ${limitMB}MB`,
        };
      }

      // 7. Read file content
      const buffer = await fs.readFile(realPath);

      // 8. Check for binary content (look for null bytes in first 8KB)
      const sampleSize = Math.min(buffer.length, 8192);
      let isBinary = false;
      for (let i = 0; i < sampleSize; i++) {
        if (buffer[i] === 0) {
          isBinary = true;
          break;
        }
      }

      if (isBinary) {
        return {
          success: true,
          data: {
            content: "[Binary file - content cannot be displayed]",
            size: stats.size,
            isBinary: true,
            encoding: "binary",
          },
        };
      }

      // 9. Decode as UTF-8 and validate
      let content: string;
      try {
        content = buffer.toString("utf-8");
        // Check for replacement character which indicates invalid UTF-8
        if (content.includes("\uFFFD")) {
          // Try to determine if it's truly binary or just has some bad chars
          const replacementCount = (content.match(/\uFFFD/g) || []).length;
          const ratio = replacementCount / content.length;
          if (ratio > 0.01) {
            // More than 1% replacement chars suggests binary
            return {
              success: true,
              data: {
                content: "[Binary file - content cannot be displayed]",
                size: stats.size,
                isBinary: true,
                encoding: "binary",
              },
            };
          }
        }
      } catch {
        return {
          success: true,
          data: {
            content: "[Binary file - content cannot be displayed]",
            size: stats.size,
            isBinary: true,
            encoding: "binary",
          },
        };
      }

      return {
        success: true,
        data: {
          content,
          size: stats.size,
          isBinary: false,
          encoding: "utf-8",
        },
      };
    } catch (error) {
      console.error("[FileExplorer] Failed to read file text:", error);
      const errCode = (error as NodeJS.ErrnoException).code;

      if (errCode === "ENOENT") {
        return { success: false, error: "File does not exist" };
      }
      if (errCode === "EACCES") {
        return { success: false, error: "Permission denied" };
      }
      if (errCode === "EISDIR") {
        return { success: false, error: "Cannot read directory as file" };
      }

      return { success: false, error: "Failed to read file" };
    }
  },

  /**
   * Recursive substring search across the workspace tree. Matches against the
   * filename and the workspace-relative path; stops as soon as `max` matches
   * are collected. No `fs.stat` per match — keeps the hot keystroke path cheap.
   */
  async searchFiles(
    options: SearchFilesOptions,
  ): Promise<ServiceResponse<DirEntry[]>> {
    const {
      rootPath,
      query,
      max = DEFAULT_SEARCH_FILES_MAX,
      includeHidden = false,
      excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
    } = options;

    const needle = query.toLowerCase();
    if (!needle) return { success: true, data: [] };

    const normalizedRoot = rootPath.replace(/\/$/, "");
    const rootPrefix = normalizedRoot + path.sep;
    const results: DirEntry[] = [];

    const walk = async (dirPath: string): Promise<void> => {
      if (results.length >= max) return;
      let entries;
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
      } catch {
        // Permission denied / vanished directory — skip silently.
        return;
      }
      for (const entry of entries) {
        if (results.length >= max) return;
        const name = entry.name;
        if (shouldExclude(name, excludePatterns, includeHidden)) continue;
        const fullPath = path.join(dirPath, name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const relativePath = fullPath.startsWith(rootPrefix)
            ? fullPath.slice(rootPrefix.length)
            : fullPath;
          if (
            name.toLowerCase().includes(needle) ||
            relativePath.toLowerCase().includes(needle)
          ) {
            results.push({
              name,
              fullPath,
              type: "file",
              hasChildren: false,
              extension: getFileExtension(name),
            });
          }
        }
      }
    };

    try {
      const rootStat = await fs.stat(rootPath);
      if (!rootStat.isDirectory()) {
        return { success: false, error: "Path is not a directory" };
      }
      await walk(rootPath);
      return { success: true, data: results };
    } catch (error) {
      const errCode = (error as NodeJS.ErrnoException).code;
      if (errCode === "ENOENT") {
        return { success: false, error: "Directory does not exist" };
      }
      if (errCode === "EACCES") {
        return { success: false, error: "Permission denied" };
      }
      console.error("[FileExplorer] searchFiles failed:", error);
      return { success: false, error: "Failed to search files" };
    }
  },

  // Immediate children only — no recursion. Used for lazy tree expansion.
  async listDir(options: ListDirOptions): Promise<ServiceResponse<DirEntry[]>> {
    const {
      dirPath,
      includeHidden = false,
      excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
    } = options;

    const resolvedPath = path.resolve(dirPath);

    try {
      // Verify it's a directory
      const dirStat = await fs.stat(resolvedPath);
      if (!dirStat.isDirectory()) {
        return { success: false, error: "Path is not a directory" };
      }

      // Read directory entries
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

      const results: DirEntry[] = [];

      // Sort: directories first, then files, alphabetically
      const sortedEntries = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });

      for (const entry of sortedEntries) {
        const name = entry.name;
        const fullPath = path.join(resolvedPath, name);

        // Check exclusions
        if (shouldExclude(name, excludePatterns, includeHidden)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Check if this directory has any visible children
          let hasChildren = false;
          try {
            const subEntries = await fs.readdir(fullPath);
            // Check if at least one entry is visible (not excluded)
            for (const subEntry of subEntries) {
              if (!shouldExclude(subEntry, excludePatterns, includeHidden)) {
                hasChildren = true;
                break;
              }
            }
          } catch (err) {
            console.warn(`[FileExplorer] Cannot read subdir ${fullPath}:`, err);
            // Can't read subdirectory - assume it might have children
            hasChildren = true;
          }

          results.push({
            name,
            fullPath,
            type: "directory",
            hasChildren,
          });
        } else if (entry.isFile()) {
          let size: number | undefined;
          try {
            const fileStat = await fs.stat(fullPath);
            size = fileStat.size;
          } catch {
            // Ignore stat errors
          }

          results.push({
            name,
            fullPath,
            type: "file",
            hasChildren: false,
            size,
            extension: getFileExtension(name),
          });
        }
      }

      return { success: true, data: results };
    } catch (error) {
      const errCode = (error as NodeJS.ErrnoException).code;
      console.error(`[FileExplorer] listDir failed for ${resolvedPath}:`, error);

      if (errCode === "ENOENT") {
        return { success: false, error: "Directory does not exist" };
      }
      if (errCode === "EACCES") {
        return { success: false, error: "Permission denied" };
      }
      return { success: false, error: `Failed to list directory: ${errCode || "unknown"}` };
    }
  },
};
