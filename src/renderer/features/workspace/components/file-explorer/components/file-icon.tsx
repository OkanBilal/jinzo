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
  GoFileIcon,
  SumFileIcon,
  FolderIcon,
  FolderOpenIcon,
  HtmlFileIcon,
  CssFileIcon,
  JsonFileIcon,
  ImageFileIcon,
  EjsFileIcon,
  IcoFileIcon,
  SvgFileIcon
} from "@/components/ui/icons/file-icons";

type FileIconType = ComponentType<SVGProps<SVGSVGElement>>;

const EXTENSION_ICONS: Record<string, FileIconType> = {
  js: JsFileIcon,
  mjs: JsFileIcon,
  cjs: JsFileIcon,
  html: HtmlFileIcon,
  css: CssFileIcon,
  ts: TsFileIcon,
  jsx: ReactFileIcon,
  tsx: ReactFileIcon,
  md: MarkdownFileIcon,
  mdx: MarkdownFileIcon,
  postcss: PostcssFileIcon,
  go: GoFileIcon,
  sum: SumFileIcon,
  mod: SumFileIcon,
  png: ImageFileIcon,
  jpg: ImageFileIcon,
  jpeg: ImageFileIcon,
  gif: ImageFileIcon,
  svg: SvgFileIcon,
  icns: ImageFileIcon,
  ejs: EjsFileIcon,
  ico: IcoFileIcon,
};

const FILENAME_ICONS: Record<string, FileIconType> = {
  ".eslintrc": EslintFileIcon,
  ".eslintrc.js": EslintFileIcon,
  ".eslintrc.cjs": EslintFileIcon,
  ".eslintrc.json": EslintFileIcon,
  "eslint.config.js": EslintFileIcon,
  "eslint.config.mjs": EslintFileIcon,
  "eslint.config.cjs": EslintFileIcon,
  ".gitignore": GitFileIcon,
  ".gitattributes": GitFileIcon,
  ".gitmodules": GitFileIcon,
  "CLAUDE.md": ClaudeFileIcon,
  ".claude": ClaudeFileIcon,
  "forge.config.js": ElectronFileIcon,
  "forge.config.ts": ElectronFileIcon,
  "electron.vite.config.js": ElectronFileIcon,
  "electron.vite.config.ts": ElectronFileIcon,
  "package.json": NodeFileIcon,
  "package-lock.json": NodeFileIcon,
  ".nvmrc": NodeFileIcon,
  ".node-version": NodeFileIcon,
  "postcss.config.js": PostcssFileIcon,
  "postcss.config.cjs": PostcssFileIcon,
  "postcss.config.mjs": PostcssFileIcon,
  "tsconfig.json": TsconfigFileIcon,
  "tsconfig.node.json": TsconfigFileIcon,
  "tsconfig.app.json": TsconfigFileIcon,
  "tsconfig.main.json": TsconfigFileIcon,
  "tsconfig.preload.json": TsconfigFileIcon,
  "tsconfig.renderer.json": TsconfigFileIcon,
  "manifest.json": JsonFileIcon,
};

const EXTENSION_COLORS: Record<string, string> = {
  js: "text-yellow-400",
  jsx: "text-yellow-400",
  ts: "text-blue-400",
  tsx: "text-blue-400",
  mjs: "text-yellow-400",
  cjs: "text-yellow-400",
  html: "text-orange-500",
  htm: "text-orange-500",
  css: "text-blue-500",
  scss: "text-pink-400",
  sass: "text-pink-400",
  less: "text-blue-600",
  json: "text-yellow-500",
  yaml: "text-red-400",
  yml: "text-red-400",
  xml: "text-orange-400",
  toml: "text-gray-400",
  md: "text-blue-300",
  mdx: "text-blue-300",
  txt: "text-gray-400",
  rst: "text-gray-400",
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
  sh: "text-green-400",
  bash: "text-green-400",
  zsh: "text-green-400",
  fish: "text-green-400",
  png: "text-purple-400",
  jpg: "text-purple-400",
  jpeg: "text-purple-400",
  gif: "text-purple-400",
  svg: "text-yellow-400",
  ico: "text-purple-400",
  webp: "text-purple-400",
  pdf: "text-red-500",
  zip: "text-yellow-600",
  tar: "text-yellow-600",
  gz: "text-yellow-600",
  env: "text-yellow-500",
  lock: "text-gray-500",
  gitignore: "text-gray-500",
};

interface IconProps {
  className?: string;
}

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

  if (fileName) {
    const FileNameIcon = FILENAME_ICONS[fileName];
    if (FileNameIcon) {
      return <FileNameIcon className={className} />;
    }
  }

  if (extension) {
    const ExtensionIcon = EXTENSION_ICONS[extension.toLowerCase()];
    if (ExtensionIcon) {
      return <ExtensionIcon className={className} />;
    }
  }

    const colorClass = extension
    ? EXTENSION_COLORS[extension.toLowerCase()] || "text-gray-400"
    : "text-gray-400";

  return <FileIcon className={`${colorClass} ${className}`} />;
});
