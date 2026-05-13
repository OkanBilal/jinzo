import { useMemo, useState, useEffect, useRef, type MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/markdown-components";
import type { EventGroup } from "../../utils/group-events";
import { Code } from "@/components/ui/icons/space";
import { Picture, Document, Codex, Close, Sparkles, External, ArrowUp } from "@/components/ui/icons";
import { ProviderIcon } from "../provider-icon";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui";
import { useLazyGetAppsForFileQuery } from "@/lib/redux/api";

const IMAGE_PATH_REGEX = /([~/]?[\w./-]+\.(?:png|jpe?g|webp|gif))\b/gi;

function extractImagePaths(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(IMAGE_PATH_REGEX)) {
    const p = m[1];
    if (!p || p.includes("://")) continue;
    const idx = m.index ?? 0;
    const before = text.slice(Math.max(0, idx - 12), idx);
    if (before.includes("://")) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

function resolveImagePath(rawPath: string, workspaceRoot?: string): string | null {
  if (!rawPath) return null;
  if (rawPath.startsWith("~")) return rawPath;
  if (rawPath.startsWith("/")) return rawPath;
  if (!workspaceRoot) return null;
  const sep = workspaceRoot.endsWith("/") ? "" : "/";
  return `${workspaceRoot}${sep}${rawPath}`;
}

function localImageUrl(absPath: string): string {
  return `mains-localimg://img/?path=${encodeURIComponent(absPath)}`;
}

function resolveImageUrl(src: string): string {
  if (/^(data:|https?:|mains-localimg:|mains-capture:)/.test(src)) return src;
  return localImageUrl(src);
}

interface PromptSkillMeta {
  name: string;
  path?: string;
  description?: string;
  displayName?: string;
  shortDescription?: string;
  iconSmall?: string;
  iconLarge?: string;
  brandColor?: string;
  scope?: string;
}

function PromptSkillChipIcon({ skill }: { skill: PromptSkillMeta }) {
  const [failed, setFailed] = useState(false);
  const iconPath = skill.iconLarge || skill.iconSmall;
  if (iconPath && !failed) {
    return (
      <img
        src={resolveImageUrl(iconPath)}
        alt=""
        className="w-3 h-3 rounded shrink-0 object-contain"
        style={skill.brandColor ? { backgroundColor: skill.brandColor } : undefined}
        onError={() => setFailed(true)}
      />
    );
  }
  return <Sparkles className="w-3 h-3 shrink-0" />;
}

function PromptSkillInlineChip({ skill }: { skill: PromptSkillMeta }) {
  const label = skill.displayName || skill.name;
  const tooltip = skill.shortDescription || skill.description || label;
  return (
    <span
      className="inline-flex align-middle items-center gap-1 px-1.5 h-6 mx-0.5 rounded-lg text-xs font-medium leading-none select-none bg-primary dark:bg-primary-300/10 dark:text-primary-200"
      title={tooltip}
    >
      <span className="inline-flex items-center justify-center size-3.5 shrink-0 rounded-sm overflow-hidden">
        <PromptSkillChipIcon skill={skill} />
      </span>
      <span className="leading-none">{label}</span>
    </span>
  );
}

/**
 * Tokenizes a user prompt message and renders `$<skillname>` substrings as inline chips.
 * Tolerates a duplicated `:<name>` suffix produced by older serializations so legacy runs
 * still display cleanly without leaving the literal word visible.
 */
function renderMessageWithSkillChips(message: string, skills: PromptSkillMeta[]) {
  if (!message) return null;
  if (skills.length === 0) return message;
  const byName = new Map(skills.map((s) => [s.name, s]));
  const names = skills
    .map((s) => s.name)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\$(${names.join("|")})(?::[\\w-]+)?(?![\\w-])`, "g");
  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(message)) !== null) {
    if (match.index > lastIdx) {
      out.push(
        <span key={`t${key++}`}>{message.slice(lastIdx, match.index)}</span>,
      );
    }
    const skill = byName.get(match[1]);
    if (skill) {
      out.push(<PromptSkillInlineChip key={`c${key++}`} skill={skill} />);
    } else {
      out.push(<span key={`t${key++}`}>{match[0]}</span>);
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < message.length) {
    out.push(<span key={`t${key++}`}>{message.slice(lastIdx)}</span>);
  }
  return out;
}

function ImagePreviewModal({ name, dataUrl, onClose }: { name: string; dataUrl: string; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="relative flex flex-col glass-morphism rounded-xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary-200 dark:border-primary-800">
          <span className="text-xs font-mono text-primary-600 dark:text-primary-400 truncate">{name}</span>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 p-1 rounded-md hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
          >
            <Close className="w-3.5 h-3.5 text-primary-500" />
          </button>
        </div>
        <div className="bg-primary-100 dark:bg-primary-900 flex items-center justify-center p-2">
          <img src={dataUrl} alt={name} className="max-h-[70vh] max-w-full object-contain rounded" />
        </div>
      </div>
    </div>
  );
}

interface InfoGroupProps {
  group: EventGroup;
  workspaceRootPath?: string;
}

export function InfoGroup({ group, workspaceRootPath }: InfoGroupProps) {
  const event = group.events[0];
  const [previewAtt, setPreviewAtt] = useState<{ name: string; dataUrl: string } | null>(null);
  if (!event) return null;

  if (event.type === "artifact" && event.metadata?.kind === "user-prompt") {
    const message = (event.content ?? "").trim();
    const isReview = event.metadata?.isReview === true;
    const issues = (event.metadata?.issues ?? []) as Array<{
      provider: string;
      number?: number | null;
      title: string;
    }>;
    const signals = (event.metadata?.signals ?? []) as Array<{
      source: string;
      level: string;
      title: string;
    }>;
    const files = ((event.metadata?.files ?? []) as Array<{ path: string }>).map((f) => {
      const lastSlash = f.path.lastIndexOf("/");
      const fileName = f.path.substring(lastSlash + 1);
      const dir = f.path.substring(0, lastSlash);
      const parentSlash = dir.lastIndexOf("/");
      const parent = dir.substring(parentSlash + 1);
      return { fullPath: f.path, displayName: parent ? `${parent}/${fileName}` : fileName };
    });
    const attachments = (event.metadata?.attachments ?? []) as Array<{
      name: string;
      type: "image" | "document";
      mimeType: string;
      dataUrl?: string;
      captureName?: string;
      sourcePath?: string;
    }>;
    const skills = (event.metadata?.skills ?? []) as PromptSkillMeta[];

    if (isReview) {
      const reviewTarget = event.metadata?.reviewTarget as string | undefined;
      const targetLabel =
        reviewTarget === "uncommittedChanges" ? "Uncommitted Changes" :
        reviewTarget === "baseBranch" ? "Branch Diff" :
        reviewTarget === "commit" ? "Commit" : "Code";

      return (
        <div className="w-full overflow-hidden">
          <div className="w-full py-2 flex justify-end">
            <div className="flex flex-col items-end gap-2 max-w-[80%]">
              <div className="px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-500/8 border border-blue-200/60 dark:border-blue-500/15">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Codex className="size-3.5 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-blue-600 dark:text-blue-300/70">{targetLabel}</span>
                  </div>
                </div>
                {message && (
                  <p className="text-xs text-blue-900 dark:text-blue-100 mt-1.5">{message}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full overflow-hidden">
        <div className="w-full py-2 flex justify-end">
          <div className="flex flex-col items-end gap-2 max-w-[80%]">
            <div className="px-3.5 py-2 rounded-2xl bg-primary-50 dark:bg-primary/5 ">
              <div className="text-primary-950 dark:text-primary">
                <p className="text-sm whitespace-pre-wrap">
                  {renderMessageWithSkillChips(message, skills)}
                </p>
              </div>
            </div>
            {previewAtt && (
              <ImagePreviewModal
                name={previewAtt.name}
                dataUrl={previewAtt.dataUrl}
                onClose={() => setPreviewAtt(null)}
              />
            )}
            {(files.length > 0 || attachments.length > 0 || issues.length > 0 || signals.length > 0) && (
              <div className="flex flex-wrap gap-1.5 justify-end">
                {issues.map((issue) => (
                  <div
                    key={`${issue.provider}-${issue.number ?? issue.title}`}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-primary-200/40 dark:bg-primary-200/20 text-primary-800 dark:text-primary-100`}
                  >
                    <ProviderIcon provider={issue.provider} className="w-3 h-3" fallback="text" />
                    <span className="truncate max-w-60">
                      {issue.number ? `#${issue.number} ` : ""}{issue.title}
                    </span>
                  </div>
                ))}
                {signals.map((signal) => (
                  <div
                    key={`${signal.source}-${signal.title}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-primary-200 dark:bg-primary-400 text-primary-600 dark:text-primary-100"
                  >
                    <ProviderIcon provider={signal.source} className="w-3 h-3" fallback="text" />
                    <span className="truncate max-w-60">
                      {signal.title}
                    </span>
                  </div>
                ))}
                {files.map((file) => (
                  <div
                    key={file.fullPath}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary-200/40 dark:bg-primary-200/20 text-xs text-primary-800 dark:text-primary-100"
                    title={file.fullPath}
                  >
                    <Code className="size-3 dark:text-primary-200 text-primary-700" />
                    <span className="text-primary-700 dark:text-primary-200">
                      {file.displayName}
                    </span>
                  </div>
                ))}
                {attachments.map((att) => {
                  const imgSrc =
                    att.dataUrl ||
                    (att.captureName ? `mains-capture://cap/${att.captureName}` : undefined);
                  return att.type === "image" && imgSrc ? (
                    <button
                      key={att.name}
                      onClick={() => setPreviewAtt({ name: att.name, dataUrl: imgSrc })}
                      className="flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-xl bg-primary-200/40 dark:bg-primary-200/20 text-xs text-primary-800 dark:text-primary-100 hover:bg-primary-100 dark:hover:bg-primary-700/30 transition-colors cursor-pointer"
                      title={`Click to preview · ${att.name}`}
                    >
                      <img
                        src={imgSrc}
                        alt={att.name}
                        className="h-6 w-6 rounded-lg object-cover  border border-primary-200/60 dark:border-primary-700/40"
                      />
                      <span className="text-primary-700 dark:text-primary-200 truncate max-w-40">
                        {att.name}
                      </span>
                    </button>
                  ) : (
                    <div
                      key={att.name}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-700/15 text-xs"
                      title={att.name}
                    >
                      {att.type === "image" ? (
                        <Picture className="size-3 dark:text-primary-200 text-primary-700" />
                      ) : (
                        <Document className="size-3 dark:text-primary-200 text-primary-700" />
                      )}
                      <span className="text-primary-700 dark:text-primary-200">
                        {att.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  //TODO: Show SDK user messages
  if (event.type === "log" && event.metadata?.level === "sdk-user") {
    return <div className="display-none" />;
  }

  if (event.type === "artifact" && event.metadata?.kind === "image") {
    const absPath = (event.metadata?.path as string | undefined) ?? "";
    if (!absPath) return null;
    const fileName = (event.metadata?.fileName as string | undefined) ?? absPath.split("/").pop() ?? "image";
    return (
      <div className="overflow-hidden">
        <ImageArtifact key={absPath} absPath={absPath} fileName={fileName} onPreview={setPreviewAtt} />
        {previewAtt && (
          <ImagePreviewModal
            name={previewAtt.name}
            dataUrl={previewAtt.dataUrl}
            onClose={() => setPreviewAtt(null)}
          />
        )}
      </div>
    );
  }

  if (event.type === "artifact") {
    const content = event.content;
    const isStreaming = event.metadata?.streaming === true;

    return (
      <ArtifactBody
        content={content}
        isStreaming={isStreaming}
        previewAtt={previewAtt}
        onPreview={setPreviewAtt}
        workspaceRootPath={workspaceRootPath}
      />
    );
  }

  return (
    <div className=" py-1.5 flex items-start gap-2 text-sm">
      <span className="text-primary-600 dark:text-primary-300">
        {event.content}
      </span>
    </div>
  );
}

function ImageArtifact({
  absPath,
  fileName,
  onPreview,
}: {
  absPath: string;
  fileName: string;
  onPreview: (att: { name: string; dataUrl: string }) => void;
}) {
  const url = localImageUrl(absPath);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const openBtnRef = useRef<HTMLButtonElement>(null);
  const [fetchApps, { data: handlerApps = [], isFetching }] = useLazyGetAppsForFileQuery();

  const ext =
    fileName.includes(".") ? (fileName.split(".").pop() ?? "").toUpperCase() : "";

  useEffect(() => {
    if (menuOpen) {
      void fetchApps(absPath);
    }
  }, [menuOpen, absPath, fetchApps]);

  const openInMains = () => {
    setMenuOpen(false);
    onPreview({ name: fileName, dataUrl: url });
  };

  const openMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (openBtnRef.current) {
      const r = openBtnRef.current.getBoundingClientRect();
      const menuWidth = 240;
      setMenuPos({
        x: Math.max(8, r.right - menuWidth),
        y: r.bottom + 6,
      });
    }
    setMenuOpen(true);
  };


  const openWithBundle = (bundleId: string) => {
    setMenuOpen(false);
    void window.api.shell.openFileWithBundle(absPath, bundleId);
  };

  return (
    <div
      className="relative flex items-center gap-3 w-full max-w-xl rounded-2xl bg-primary-50 dark:bg-primary-900/85 px-3 py-2.5 shadow-sm"
      title={absPath}
    >
      <button
        type="button"
        onClick={openInMains}
        className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-400 overflow-hidden"
        aria-label={`Preview ${fileName} in Mains`}
      >
        <div className="size-10 rounded-lg border border-primary-700/40 dark:border-primary-600/30 bg-primary-900 dark:bg-primary-950/80 flex items-center justify-center overflow-hidden">
          {!thumbFailed ? (
            <img
              src={url}
              alt=""
              className="size-full object-cover"
              loading="lazy"
              draggable={false}
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <Picture className="size-5 text-primary-100 dark:text-primary-200" />
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={openInMains}
        className="flex-1 min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-md"
      >
        <div className="text-sm font-medium text-primary-950 dark:text-primary truncate">
          {fileName}
        </div>
        <div className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">
          Image{ext ? ` · ${ext}` : ""}
        </div>
      </button>
      <button
        ref={openBtnRef}
        type="button"
        onClick={openMenu}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-primary-800 dark:text-primary-100  bg-primary-100/80 dark:bg-primary-800/40 hover:bg-primary-200/60 dark:hover:bg-primary-700/35 transition-colors cursor-pointer"
      >
        Open
        <ArrowUp className="size-3.5  rotate-180" />
      </button>
      <DropdownMenu
        isOpen={menuOpen}
        position={menuPos}
        onClose={() => setMenuOpen(false)}
        minWidth={240}
        origin="top-right"
      >
        <DropdownMenuItem onClick={openInMains}>Show Image</DropdownMenuItem>
        {isFetching ? (
          <div className="px-3 py-2 text-xs text-primary-500 dark:text-primary-400">
            Loading applications…
          </div>
        ) : (
          handlerApps.map((app) => (
            <DropdownMenuItem
              key={app.bundleId}
              onClick={() => openWithBundle(app.bundleId)}
            >
              {app.icon ? (
                <img
                  src={app.icon}
                  alt=""
                  draggable={false}
                  className="size-4 shrink-0 rounded-sm"
                />
              ) : (
                <External className="size-4 shrink-0 opacity-70" />
              )}
              <span className="truncate">{app.name}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenu>
    </div>
  );
}

function ArtifactBody({
  content,
  isStreaming,
  previewAtt,
  onPreview,
  workspaceRootPath,
}: {
  content: string;
  isStreaming: boolean;
  previewAtt: { name: string; dataUrl: string } | null;
  onPreview: (att: { name: string; dataUrl: string } | null) => void;
  workspaceRootPath?: string;
}) {
  const resolvedImages = useMemo(() => {
    const out: Array<{ key: string; raw: string; abs: string; name: string }> = [];
    const seen = new Set<string>();
    for (const raw of extractImagePaths(content)) {
      const abs = resolveImagePath(raw, workspaceRootPath);
      if (!abs || seen.has(abs)) continue;
      seen.add(abs);
      out.push({ key: abs, raw, abs, name: raw.split("/").pop() ?? raw });
    }
    return out;
  }, [content, workspaceRootPath]);

  // Track images whose load failed so we hide them instead of leaving a
  // broken icon. The extractor pulls path-like substrings from the markdown,
  // resolves them against the workspace root, and renders an <img> for each;
  // when the file doesn't actually live there (codex saves to ~/.codex/…
  // etc.) the protocol returns 404 and the browser falls back to a broken
  // image glyph. Mirrors ImageArtifact's onError behavior.
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const visibleImages = resolvedImages.filter((img) => !failedImages.has(img.key));

  return (
    <div className="overflow-hidden">
      <div className="prose prose-sm dark:prose-invert max-w-none relative">
        <div className={isStreaming ? "streaming-text" : undefined}>
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={[remarkGfm]}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
      {visibleImages.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {visibleImages.map(({ key, abs, name }) => {
            const url = localImageUrl(abs);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPreview({ name, dataUrl: url })}
                className="block w-full overflow-hidden rounded-xl border border-primary-200/40 dark:border-primary-700/40 bg-primary-100 dark:bg-primary-900 cursor-pointer"
                title={abs}
              >
                <img
                  src={url}
                  alt={name}
                  className="w-full max-h-[480px] object-contain"
                  loading="lazy"
                  onError={() =>
                    setFailedImages((prev) => {
                      if (prev.has(key)) return prev;
                      const next = new Set(prev);
                      next.add(key);
                      return next;
                    })
                  }
                />
              </button>
            );
          })}
        </div>
      )}
      {previewAtt && (
        <ImagePreviewModal
          name={previewAtt.name}
          dataUrl={previewAtt.dataUrl}
          onClose={() => onPreview(null)}
        />
      )}
    </div>
  );
}


