import { useMemo, useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/markdown-components";
import type { EventGroup } from "../../utils/group-events";
import { Code } from "@/components/ui/icons/space";
import { Picture, Document, Codex, Close, Sparkles } from "@/components/ui/icons";
import { ProviderIcon } from "../provider-icon";

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
    const skills = (event.metadata?.skills ?? []) as Array<{
      name: string;
      path?: string;
      description?: string;
    }>;

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
            <div className="px-4 py-2.5 rounded-2xl bg-primary-50 dark:bg-primary/5 ">
              <div className="text-primary-950 dark:text-primary">
                <p className="text-sm whitespace-pre-wrap">{message}</p>
              </div>
            </div>
            {previewAtt && (
              <ImagePreviewModal
                name={previewAtt.name}
                dataUrl={previewAtt.dataUrl}
                onClose={() => setPreviewAtt(null)}
              />
            )}
            {(files.length > 0 || attachments.length > 0 || issues.length > 0 || signals.length > 0 || skills.length > 0) && (
              <div className="flex flex-wrap gap-1.5 justify-end">
                {skills.map((skill) => (
                  <div
                    key={`skill-${skill.name}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-violet-500/15 text-violet-300"
                    title={skill.description ?? skill.name}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span className="truncate max-w-60">{skill.name}</span>
                  </div>
                ))}
                {issues.map((issue) => (
                  <div
                    key={`${issue.provider}-${issue.number ?? issue.title}`}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-primary-200 dark:bg-primary-400 text-primary-600 dark:text-primary-100`}
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
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-700/15 text-xs"
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
                      className="flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-xl bg-primary-50 dark:bg-primary-700/15 text-xs hover:bg-primary-100 dark:hover:bg-primary-700/30 transition-colors cursor-pointer"
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
        <ImageArtifact absPath={absPath} fileName={fileName} onPreview={setPreviewAtt} />
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
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <div
        className="rounded-xl  dark:bg-red-900/5 bg-red-700/5 px-4 py-3 text-xs dark:text-red-300 text-red-700 break-all"
        title={absPath}
      >
        <div className="font-medium mb-1">Image failed to load</div>
        <div className="opacity-70 dark:text-red-300 text-red-700">{error}</div>
        <div className="mt-1 font-mono opacity-60">{absPath}</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPreview({ name: fileName, dataUrl: url })}
      className="block w-full overflow-hidden rounded-xl border-2 border-primary-200/40 dark:border-primary-800/50 bg-primary-100 dark:bg-primary-900 cursor-pointer"
      title={absPath}
    >
      <img
        src={url}
        alt={fileName}
        className="w-full h-full object-contain"
        loading="lazy"
        onError={(e) => {
          const target = e.currentTarget;
          console.error("[mains-localimg] image load failed", {
            src: target.src,
            absPath,
            naturalWidth: target.naturalWidth,
            naturalHeight: target.naturalHeight,
          });
          setError(`Failed to load (src=${target.src})`);
        }}
        onLoad={() => {
          console.log("[mains-localimg] image loaded:", absPath);
        }}
      />
    </button>
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
      {resolvedImages.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {resolvedImages.map(({ key, abs, name }) => {
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


