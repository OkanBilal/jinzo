import { memo, ComponentType, SVGProps } from "react";
import {
  MarkdownFileIcon,
  EslintFileIcon,
  GitFileIcon,
  ClaudeFileIcon,
  ElectronFileIcon,
  JsFileIcon,
  TsFileIcon,
  NodeFileIcon,
  PostcssFileIcon,
  ReactFileIcon,
  TsconfigFileIcon,
} from "@/components/ui/icons/file-icons";

// ─────────────────────────────────────────────────────────────
// File Extension to Icon Mapping
// ─────────────────────────────────────────────────────────────

type FileIconType = ComponentType<SVGProps<SVGSVGElement>>;

// Map extensions to their specific icon components
const EXTENSION_ICONS: Record<string, FileIconType> = {
  // JavaScript
  js: JsFileIcon,
  mjs: JsFileIcon,
  cjs: JsFileIcon,

  // TypeScript
  ts: TsFileIcon,

  // React (JSX/TSX)
  jsx: ReactFileIcon,
  tsx: ReactFileIcon,

  // Markdown
  md: MarkdownFileIcon,
  mdx: MarkdownFileIcon,

  // Config files
  postcss: PostcssFileIcon,
};

// Map specific file names to their icon components
const FILENAME_ICONS: Record<string, FileIconType> = {
  // ESLint
  ".eslintrc": EslintFileIcon,
  ".eslintrc.js": EslintFileIcon,
  ".eslintrc.cjs": EslintFileIcon,
  ".eslintrc.json": EslintFileIcon,
  "eslint.config.js": EslintFileIcon,
  "eslint.config.mjs": EslintFileIcon,
  "eslint.config.cjs": EslintFileIcon,

  // Git
  ".gitignore": GitFileIcon,
  ".gitattributes": GitFileIcon,
  ".gitmodules": GitFileIcon,

  // Claude
  "CLAUDE.md": ClaudeFileIcon,
  ".claude": ClaudeFileIcon,

  // Electron / Forge
  "forge.config.js": ElectronFileIcon,
  "forge.config.ts": ElectronFileIcon,
  "electron.vite.config.js": ElectronFileIcon,
  "electron.vite.config.ts": ElectronFileIcon,

  // Node
  "package.json": NodeFileIcon,
  "package-lock.json": NodeFileIcon,
  ".nvmrc": NodeFileIcon,
  ".node-version": NodeFileIcon,

  // PostCSS
  "postcss.config.js": PostcssFileIcon,
  "postcss.config.cjs": PostcssFileIcon,
  "postcss.config.mjs": PostcssFileIcon,

  // TypeScript config
  "tsconfig.json": TsconfigFileIcon,
  "tsconfig.node.json": TsconfigFileIcon,
  "tsconfig.app.json": TsconfigFileIcon,
  "tsconfig.main.json": TsconfigFileIcon,
  "tsconfig.preload.json": TsconfigFileIcon,
  "tsconfig.renderer.json": TsconfigFileIcon,
};

const EXTENSION_COLORS: Record<string, string> = {
  // JavaScript/TypeScript
  js: "text-yellow-400",
  jsx: "text-yellow-400",
  ts: "text-blue-400",
  tsx: "text-blue-400",
  mjs: "text-yellow-400",
  cjs: "text-yellow-400",

  // Web
  html: "text-orange-500",
  htm: "text-orange-500",
  css: "text-blue-500",
  scss: "text-pink-400",
  sass: "text-pink-400",
  less: "text-blue-600",

  // Data/Config
  json: "text-yellow-500",
  yaml: "text-red-400",
  yml: "text-red-400",
  xml: "text-orange-400",
  toml: "text-gray-400",

  // Markdown/Docs
  md: "text-blue-300",
  mdx: "text-blue-300",
  txt: "text-gray-400",
  rst: "text-gray-400",

  // Programming
  py: "text-green-400",
  rb: "text-red-500",
  go: "text-cyan-400",
  rs: "text-orange-400",
  java: "text-red-400",
  kt: "text-purple-400",
  swift: "text-orange-500",
  c: "text-blue-500",
  cpp: "text-blue-500",
  h: "text-purple-400",
  hpp: "text-purple-400",
  cs: "text-green-500",
  php: "text-indigo-400",

  // Shell
  sh: "text-green-400",
  bash: "text-green-400",
  zsh: "text-green-400",
  fish: "text-green-400",

  // Images
  png: "text-purple-400",
  jpg: "text-purple-400",
  jpeg: "text-purple-400",
  gif: "text-purple-400",
  svg: "text-yellow-400",
  ico: "text-purple-400",
  webp: "text-purple-400",

  // Other
  pdf: "text-red-500",
  zip: "text-yellow-600",
  tar: "text-yellow-600",
  gz: "text-yellow-600",
  env: "text-yellow-500",
  lock: "text-gray-500",
  gitignore: "text-gray-500",
};

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

interface IconProps {
  className?: string;
}

export const FolderIcon = memo(function FolderIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1.5 3.5A1.5 1.5 0 013 2h3.379a1.5 1.5 0 011.06.44l.622.62a.5.5 0 00.354.147H13a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H3a1.5 1.5 0 01-1.5-1.5v-9z"
        fill="currentColor"
      />
    </svg>
  );
});

export const FolderOpenIcon = memo(function FolderOpenIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1 4.5A1.5 1.5 0 012.5 3h3.379a1.5 1.5 0 011.06.44l.622.62a.5.5 0 00.354.147H13.5A1.5 1.5 0 0115 5.707v.043H2V4.5z"
        fill="currentColor"
      />
      <path
        d="M1.5 6.5h13l-1.5 7H3l-1.5-7z"
        fill="currentColor"
        fillOpacity="0.8"
      />
    </svg>
  );
});

export const FileIcon = memo(function FileIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 1.5A1.5 1.5 0 015 0h4.379a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 01.439 1.061V14.5a1.5 1.5 0 01-1.5 1.5H5a1.5 1.5 0 01-1.5-1.5v-13z"
        fill="currentColor"
      />
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────
// Main File Icon Component
// ─────────────────────────────────────────────────────────────

interface FileIconComponentProps {
  extension?: string;
  fileName?: string;
  isDirectory?: boolean;
  isExpanded?: boolean;
  className?: string;
}

export const FileIconComponent = memo(function FileIconComponent({
  extension,
  fileName,
  isDirectory,
  isExpanded,
  className = "",
}: FileIconComponentProps) {
  if (isDirectory) {
    const colorClass = "text-amber-400 dark:text-amber-300";
    if (isExpanded) {
      return <FolderOpenIcon className={`${colorClass} ${className}`} />;
    }
    return <FolderIcon className={`${colorClass} ${className}`} />;
  }

  // Check for specific filename match first
  if (fileName) {
    const FileNameIcon = FILENAME_ICONS[fileName];
    if (FileNameIcon) {
      return <FileNameIcon className={className} />;
    }
  }

  // Check for extension-based icon
  if (extension) {
    const ExtensionIcon = EXTENSION_ICONS[extension.toLowerCase()];
    if (ExtensionIcon) {
      return <ExtensionIcon className={className} />;
    }
  }

  // Fallback to colored generic file icon
  const colorClass = extension
    ? EXTENSION_COLORS[extension.toLowerCase()] || "text-gray-400"
    : "text-gray-400";

  return <FileIcon className={`${colorClass} ${className}`} />;
});
