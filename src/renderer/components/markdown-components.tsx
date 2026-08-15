import { useState } from "react";
import type { ReactNode } from "react";
import { Components } from "react-markdown";

import Text from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { CODE_FONT_SIZE_CSS } from "@/lib/appearance-fonts";
import { proxiedImageSrc } from "@/lib/proxied-image-src";
import { FileIconComponent } from "@/features/workspace/components/file-explorer/components/file-icon";
import { useOpenFileInEditor } from "@/features/workspace/hooks/use-open-file-in-editor";

/**
 * Split a trailing line locator off a file href: `path.ts:114`,
 * `path.ts:114:7`, or `path.ts#L114-120` all resolve to `path.ts`.
 */
function splitFileHref(href: string): { path: string; line?: number } {
  const hash = href.match(/^(.*?)#L(\d+)(?:-\d+)?$/);
  if (hash) return { path: hash[1], line: Number(hash[2]) };
  const colon = href.match(/^(.*?):(\d+)(?::\d+)?$/);
  if (colon) return { path: colon[1], line: Number(colon[2]) };
  return { path: href };
}

/**
 * Href with no URL scheme whose last segment looks like a file — an agent's
 * reference to a workspace file rather than a web link.
 */
function isFileHref(href: string): boolean {
  if (!href || href.startsWith("#") || href.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return false;
  const last = href.split("/").pop() ?? "";
  return /\.[A-Za-z0-9]+$/.test(last) || href.includes("/");
}

/**
 * File references render as an icon chip and open in the editor tab; real
 * URLs open in the system browser.
 */
function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const openFileInEditor = useOpenFileInEditor();

  const target = href ? splitFileHref(href) : null;
  if (href && target && isFileHref(target.path)) {
    const basename = target.path.split("/").pop() ?? target.path;
    const dotIdx = basename.lastIndexOf(".");
    const extension =
      dotIdx > 0 && dotIdx < basename.length - 1
        ? basename.slice(dotIdx + 1)
        : undefined;
    return (
      <Button
        onClick={() => openFileInEditor(target.path)}
        title={href}
        className="inline-flex align-middle items-center gap-1 px-1.5 mb-0.5 h-6 mx-0.5 rounded-lg text-xs font-medium leading-none select-none bg-primary-50 dark:bg-primary-300/10 text-primary-800 dark:text-primary-200 cursor-pointer hover:bg-primary-200/60 dark:hover:bg-primary-300/20 transition-colors"
      >
        <FileIconComponent
          extension={extension}
          fileName={basename}
          className="size-3.5 shrink-0"
        />
        <span className="leading-none truncate max-w-60">{children}</span>
      </Button>
    );
  }

  return (
    <Button
      onClick={() => {
        if (href) {
          window.api.shell.openExternal(href);
        }
      }}
      className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 underline cursor-pointer inline"
    >
      {children}
    </Button>
  );
}

/** Network URLs — the only sources whose mere loading has a side effect. */
export function isRemoteImageSrc(src: string | undefined | null): src is string {
  return !!src && (src.startsWith("https://") || src.startsWith("http://"));
}

/**
 * Markdown `img` with consent-gated remote loading.
 *
 * Markdown reaching this renderer is largely untrusted — agent/subagent
 * reports and external service bodies (issues, signals) alike — and an
 * auto-fetched remote image is a data-exfiltration beacon: a prompt-injected
 * agent can embed secrets in the URL's query string, and the request fires
 * the moment the view renders (through the proxy or not — the request itself
 * is the leak). Remote images therefore render as a click-to-load
 * placeholder; local sources (data:, app capture schemes, workspace paths)
 * have no network side effect and load directly. There is deliberately no
 * fallback to the raw URL on proxy error — that would reopen the channel.
 */
function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [loadApproved, setLoadApproved] = useState(false);
  const remote = isRemoteImageSrc(src);

  if (remote && !loadApproved) {
    let host = src;
    try {
      host = new URL(src).host;
    } catch {
      // Unparseable URL — show it verbatim so the user can judge it.
    }
    return (
      <Button
        onClick={() => setLoadApproved(true)}
        title={src}
        className="my-2 flex w-fit max-w-full items-center gap-2 rounded-lg border border-dashed border-primary-300 px-3 py-2 text-xs text-primary-500 transition-colors hover:border-primary-400 hover:text-primary-700 dark:border-primary-700 dark:hover:border-primary-500 dark:hover:text-primary-300"
      >
        <span className="truncate">
          {alt?.trim() ? `${alt.trim()} — ` : ""}remote image from {host}
        </span>
        <Text as="span" size="inherit" tone="inherit" weight="medium" className="shrink-0">
          Load
        </Text>
      </Button>
    );
  }

  return (
    <img
      src={proxiedImageSrc(src) ?? src}
      alt={alt || ""}
      className="max-w-full h-auto rounded-lg my-2 border border-primary-200 dark:border-primary-700"
    />
  );
}

/**
 * Custom ReactMarkdown component overrides for consistent styling.
 *
 * Every prose node routes through {@link Text}, whose default tone is the prose
 * tone — so no entry below names a colour, and none of them can drift apart the
 * way `th` and `td` once had. `className` is left holding layout only: margins,
 * list decoration, table rules, and the `font-sans` that pulls prose out of a
 * monospace ancestor.
 */
export const  markdownComponents: Components = {
  h1: ({ children }) => (
    <Text as="h1" size="lg" weight="bold" className="mt-4 mb-2 font-sans">
      {children}
    </Text>
  ),
  h2: ({ children }) => (
    <Text as="h2" size="base" weight="semibold" className="mt-2 mb-1 font-sans">
      {children}
    </Text>
  ),
  h3: ({ children }) => (
    <Text as="h3" weight="semibold" className="mt-2 mb-1 font-sans">
      {children}
    </Text>
  ),
  h4: ({ children }) => (
    <Text as="h4" size="xs" weight="semibold" className="mt-1 mb-0.5 font-sans">
      {children}
    </Text>
  ),
  p: ({ children }) => (
    <Text as="p" className="leading-7 font-sans">
      {children}
    </Text>
  ),
  ul: ({ children }) => (
    <Text as="ul" className="list-disc list-outside pl-4 font-sans mb-2 space-y-1">
      {children}
    </Text>
  ),
  ol: ({ children }) => (
    <Text
      as="ol"
      className="list-decimal list-outside pl-4 font-sans mb-2 space-y-1"
    >
      {children}
    </Text>
  ),
  li: ({ children }) => (
    <Text
      as="li"
      className="font-sans leading-7 [&>p]:my-0 [&>p:not(:last-child)]:mb-1"
    >
      {children}
    </Text>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-lg border border-primary-300 dark:border-primary-700">
      <table className="min-w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-primary-50 dark:bg-primary/10">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="bg-primary dark:bg-primary/5">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-primary-200 dark:border-primary-700 hover:bg-primary-200/20 dark:hover:bg-primary/5 transition-colors duration-150">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <Text
      as="th"
      weight="semibold"
      align="left"
      className="px-4 py-3 font-sans border-r border-primary-200 dark:border-primary-700 last:border-r-0"
    >
      {children}
    </Text>
  ),
  td: ({ children }) => (
    <Text
      as="td"
      className="px-4 py-3 font-sans border-r border-primary-200 dark:border-primary-700 last:border-r-0"
    >
      {children}
    </Text>
  ),
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      // `size="inherit"` yields to the `0.9em` below: inline code stays relative
      // to its sentence so it never towers over the prose around it.
      return (
        <Text
          as="code"
          size="inherit"
          className="px-1 py-0.5 rounded text-[0.9em] bg-primary-200/40 dark:bg-primary/10"
        >
          {children}
        </Text>
      );
    }
    // Blocks carry the Code font-size setting instead, which is a pixel value
    // off the `--text-*` ramp — hence `size="inherit"` here too.
    return (
      <Text
        as="code"
        size="inherit"
        className="block p-4 rounded-xl bg-primary-100 dark:bg-primary-900 overflow-x-auto"
        style={{ fontSize: CODE_FONT_SIZE_CSS }}
      >
        {children}
      </Text>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 rounded-xl  overflow-hidden bg-primary-50 dark:bg-primary/10">{children}</pre>
  ),
  a: ({ href, children }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
  // The three inline marks size themselves from the sentence they sit in.
  blockquote: ({ children }) => (
    <Text
      as="blockquote"
      size="inherit"
      tone="muted"
      className="border-l-4 border-primary-400 dark:border-primary-600 pl-4 py-1 my-2 italic"
    >
      {children}
    </Text>
  ),
  strong: ({ children }) => (
    <Text as="strong" size="inherit" weight="semibold">
      {children}
    </Text>
  ),
  em: ({ children }) => (
    <Text as="em" size="inherit" className="italic">
      {children}
    </Text>
  ),
  hr: () => <hr className="my-4 border-primary-300 dark:border-primary-700" />,
  img: ({ src, alt }) => (
    <MarkdownImage src={typeof src === "string" ? src : undefined} alt={alt} />
  ),
};
