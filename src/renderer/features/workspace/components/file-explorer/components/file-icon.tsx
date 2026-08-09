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
  SvgFileIcon,
  PythonFileIcon,
  RustFileIcon,
  RubyFileIcon,
  JavaFileIcon,
  CppFileIcon,
  PhpFileIcon,
  VueFileIcon,
  SvelteFileIcon,
  YamlFileIcon,
  XmlFileIcon,
  DatabaseFileIcon,
  CsvFileIcon,
  TextFileIcon,
  PdfFileIcon,
  ArchiveFileIcon,
  FontFileIcon,
  VideoFileIcon,
  AudioFileIcon,
  ShellFileIcon,
  EnvFileIcon,
  LockFileIcon,
  DockerFileIcon,
  TailwindFileIcon,
  ViteFileIcon,
  VitestFileIcon,
  DrizzleFileIcon,
  LicenseFileIcon,
  GraphqlFileIcon,
  NextFileIcon,
  PnpmFileIcon
} from "@/components/ui/icons/file-icons";

type FileIconType = ComponentType<SVGProps<SVGSVGElement>>;

const EXTENSION_ICONS: Record<string, FileIconType> = {
  js: JsFileIcon,
  mjs: JsFileIcon,
  cjs: JsFileIcon,
  html: HtmlFileIcon,
  htm: HtmlFileIcon,
  css: CssFileIcon,
  ts: TsFileIcon,
  mts: TsFileIcon,
  cts: TsFileIcon,
  jsx: ReactFileIcon,
  tsx: ReactFileIcon,
  md: MarkdownFileIcon,
  mdx: MarkdownFileIcon,
  postcss: PostcssFileIcon,
  go: GoFileIcon,
  sum: SumFileIcon,
  mod: SumFileIcon,
  json: JsonFileIcon,
  jsonc: JsonFileIcon,
  json5: JsonFileIcon,
  png: ImageFileIcon,
  jpg: ImageFileIcon,
  jpeg: ImageFileIcon,
  gif: ImageFileIcon,
  webp: ImageFileIcon,
  avif: ImageFileIcon,
  bmp: ImageFileIcon,
  svg: SvgFileIcon,
  icns: ImageFileIcon,
  ejs: EjsFileIcon,
  ico: IcoFileIcon,
  py: PythonFileIcon,
  pyi: PythonFileIcon,
  pyw: PythonFileIcon,
  rs: RustFileIcon,
  rb: RubyFileIcon,
  erb: RubyFileIcon,
  java: JavaFileIcon,
  c: CppFileIcon,
  h: CppFileIcon,
  cc: CppFileIcon,
  cpp: CppFileIcon,
  cxx: CppFileIcon,
  hpp: CppFileIcon,
  hh: CppFileIcon,
  php: PhpFileIcon,
  vue: VueFileIcon,
  svelte: SvelteFileIcon,
  yml: YamlFileIcon,
  yaml: YamlFileIcon,
  xml: XmlFileIcon,
  plist: XmlFileIcon,
  xsd: XmlFileIcon,
  xsl: XmlFileIcon,
  sql: DatabaseFileIcon,
  db: DatabaseFileIcon,
  sqlite: DatabaseFileIcon,
  sqlite3: DatabaseFileIcon,
  csv: CsvFileIcon,
  tsv: CsvFileIcon,
  txt: TextFileIcon,
  text: TextFileIcon,
  log: TextFileIcon,
  rtf: TextFileIcon,
  pdf: PdfFileIcon,
  zip: ArchiveFileIcon,
  tar: ArchiveFileIcon,
  gz: ArchiveFileIcon,
  tgz: ArchiveFileIcon,
  bz2: ArchiveFileIcon,
  xz: ArchiveFileIcon,
  rar: ArchiveFileIcon,
  "7z": ArchiveFileIcon,
  woff: FontFileIcon,
  woff2: FontFileIcon,
  ttf: FontFileIcon,
  otf: FontFileIcon,
  eot: FontFileIcon,
  mp4: VideoFileIcon,
  mov: VideoFileIcon,
  webm: VideoFileIcon,
  mkv: VideoFileIcon,
  avi: VideoFileIcon,
  m4v: VideoFileIcon,
  mp3: AudioFileIcon,
  wav: AudioFileIcon,
  flac: AudioFileIcon,
  m4a: AudioFileIcon,
  ogg: AudioFileIcon,
  aac: AudioFileIcon,
  sh: ShellFileIcon,
  bash: ShellFileIcon,
  zsh: ShellFileIcon,
  fish: ShellFileIcon,
  env: EnvFileIcon,
  lock: LockFileIcon,
  lockb: LockFileIcon,
  graphql: GraphqlFileIcon,
  gql: GraphqlFileIcon,
};

const FILENAME_ICONS: Record<string, FileIconType> = {
  ".gitignore": GitFileIcon,
  ".gitattributes": GitFileIcon,
  ".gitmodules": GitFileIcon,
  "CLAUDE.md": ClaudeFileIcon,
  ".claude": ClaudeFileIcon,
  "package.json": NodeFileIcon,
  "package-lock.json": NodeFileIcon,
  ".nvmrc": NodeFileIcon,
  ".node-version": NodeFileIcon,
  ".npmrc": NodeFileIcon,
  "manifest.json": JsonFileIcon,
  "Dockerfile": DockerFileIcon,
  ".dockerignore": DockerFileIcon,
  // pnpm's files say `.yaml`, and its lockfile isn't a plain `.lock` — without
  // these they fall through to the YAML icon (and the lock/node ones are wrong
  // when the tool has a mark of its own).
  "pnpm-lock.yaml": PnpmFileIcon,
  "pnpm-workspace.yaml": PnpmFileIcon,
  ".pnpmfile.cjs": PnpmFileIcon,
  "Cargo.toml": RustFileIcon,
  "Gemfile": RubyFileIcon,
  "pyproject.toml": PythonFileIcon,
  "requirements.txt": PythonFileIcon,
};

/**
 * Config files that come in families (`tsconfig.main.json`, `vite.renderer
 * .config.mjs`, `drizzle.config.runtime.ts`, `.env.local`, `Dockerfile.dev`).
 * Matched only after an exact FILENAME_ICONS hit, so a specific name always
 * wins over its family.
 *
 * The variant segment appears on either side of `.config` depending on the
 * tool, hence the optional group before and after. Order matters where two
 * families share a prefix: vitest is tested before vite.
 */
const CONFIG = String.raw`(\..+)?\.config(\..+)?\.[cm]?[jt]s$`;

const FILENAME_PATTERNS: Array<[RegExp, FileIconType]> = [
  [/^\.eslintrc(\..+)?$/, EslintFileIcon],
  [new RegExp(`^eslint${CONFIG}`), EslintFileIcon],
  [/^tsconfig(\..+)?\.json$/, TsconfigFileIcon],
  [new RegExp(`^postcss${CONFIG}`), PostcssFileIcon],
  [new RegExp(`^tailwind${CONFIG}`), TailwindFileIcon],
  [new RegExp(`^(forge|electron\\.vite)${CONFIG}`), ElectronFileIcon],
  [new RegExp(`^vitest${CONFIG}`), VitestFileIcon],
  [new RegExp(`^vite${CONFIG}`), ViteFileIcon],
  [new RegExp(`^drizzle${CONFIG}`), DrizzleFileIcon],
  [new RegExp(`^next${CONFIG}`), NextFileIcon],
  [/^\.env(\..+)?$/, EnvFileIcon],
  [/^(docker-)?compose(\..+)?\.ya?ml$/, DockerFileIcon],
  [/^Dockerfile\..+$/, DockerFileIcon],
  [/^(LICENSE|LICENCE|COPYING)(\..+)?$/i, LicenseFileIcon],
];

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

/**
 * Pick the dedicated icon for a file, or null when only the generic page glyph
 * (tinted by EXTENSION_COLORS) applies. Resolution order is exact filename →
 * filename family → extension: `tsconfig.json` must not lose to `.json`.
 */
export function resolveFileIcon(
  fileName?: string,
  extension?: string,
): FileIconType | null {
  if (fileName) {
    const exact = FILENAME_ICONS[fileName];
    if (exact) return exact;
    const patterned = FILENAME_PATTERNS.find(([re]) => re.test(fileName));
    if (patterned) return patterned[1];
  }
  if (extension) {
    const byExtension = EXTENSION_ICONS[extension.toLowerCase()];
    if (byExtension) return byExtension;
  }
  return null;
}

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

  const Resolved = resolveFileIcon(fileName, extension);
  if (Resolved) {
    return <Resolved className={className} />;
  }

    const colorClass = extension
    ? EXTENSION_COLORS[extension.toLowerCase()] || "text-gray-400"
    : "text-gray-400";

  return <FileIcon className={`${colorClass} ${className}`} />;
});
