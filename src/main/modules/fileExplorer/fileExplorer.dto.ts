// ─────────────────────────────────────────────────────────────
// File Explorer Types
// ─────────────────────────────────────────────────────────────

export type FileNodeType = "file" | "directory";

export interface FileNode {
  name: string;
  fullPath: string;
  type: FileNodeType;
  children?: FileNode[];
  /** For directories: true if has at least one visible child, undefined if not checked */
  hasChildren?: boolean;
  size?: number;
  modifiedAt?: string;
  extension?: string;
}

/** Entry returned by listDir for lazy loading */
export interface DirEntry {
  name: string;
  fullPath: string;
  type: FileNodeType;
  /** For directories: true if has at least one visible child */
  hasChildren: boolean;
  size?: number;
  extension?: string;
}

/** Options for listDir */
export interface ListDirOptions {
  dirPath: string;
  includeHidden?: boolean;
  excludePatterns?: string[];
}

export interface ReadDirectoryOptions {
  rootPath: string;
  depth?: number; // Max recursion depth, undefined = infinite
  includeHidden?: boolean;
  excludePatterns?: string[]; // Glob patterns to exclude
}

export interface ServiceResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FileTreeResponse {
  root: FileNode;
  totalFiles: number;
  totalDirectories: number;
}

// File content response
export interface FileContentResponse {
  content: string;
  size: number;
  isBinary: boolean;
  encoding: "utf-8" | "binary";
}

// Read file text options
export interface ReadFileTextOptions {
  filePath: string;
  workspaceRoot: string;
  maxSizeBytes?: number; // Default 2MB
}

// Max file size constant (2MB)
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

// Default patterns to exclude (common IDE/build artifacts)
// NOTE: Do NOT add source folders like "main", "renderer", "preload", "src" here
export const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  "out",
  ".cache",
  ".next",
  ".nuxt",
  "__pycache__",
  ".pytest_cache",
  "target",
  ".idea",
  ".vscode",
  "*.log",
  ".DS_Store",
  "Thumbs.db",
];
