import type { ReactNode } from "react";
import { Components } from "react-markdown";

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
      <button
        type="button"
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
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (href) {
          window.api.shell.openExternal(href);
        }
      }}
      className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 underline cursor-pointer inline"
    >
      {children}
    </button>
  );
}

/**
 * Custom ReactMarkdown component overrides for consistent styling.
 */
export const  markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold mt-4 mb-2 font-sans text-primary-900 dark:text-primary">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold mt-2 mb-1 font-sans text-primary-900 dark:text-primary">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1 font-sans text-primary-900 dark:text-primary">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-xs font-semibold mt-1 mb-0.5 font-sans text-primary-900 dark:text-primary">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className=" text-sm leading-7 font-sans text-primary-900 dark:text-primary">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside  pl-4 text-sm  font-sans mb-2 space-y-1 text-primary-900 dark:text-primary">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal  list-outside pl-4 text-sm font-sans mb-2 space-y-1 text-primary-900 dark:text-primary">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="font-sans text-sm leading-7 text-primary-900 dark:text-primary [&>p]:my-0 [&>p:not(:last-child)]:mb-1">
      {children}
    </li>
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
    <th className="px-4 py-3 text-left text-sm font-semibold font-sans text-primary-900 dark:text-primary-100 border-r border-primary-200 dark:border-primary-700 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-sm font-sans text-primary-900 dark:text-primary border-r border-primary-200 dark:border-primary-700 last:border-r-0">
      {children}
    </td>
  ),
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="px-1 py-0.5 rounded text-primary-900 dark:text-primary text-[0.9em] bg-primary-200/40 dark:bg-primary/10 ">
          {children}
        </code>
      );
    }
    return (
      <code className="block p-4 rounded-xl bg-primary-50 dark:bg-primary/10 text-primary-900 dark:text-primary text-[0.9em] overflow-x-auto">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 rounded-xl  overflow-hidden bg-primary-50 dark:bg-primary/10">{children}</pre>
  ),
  a: ({ href, children }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary-400 dark:border-primary-600 pl-4 py-1 my-2 italic text-primary-700 dark:text-primary-300">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-primary-900 dark:text-primary">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic text-primary-900 dark:text-primary">
      {children}
    </em>
  ),
  hr: () => <hr className="my-4 border-primary-300 dark:border-primary-700" />,
  img: ({ src, alt }) => {
    const proxiedSrc = proxiedImageSrc(src) ?? src;
    return (
      <img
        src={proxiedSrc}
        alt={alt || ""}
        className="max-w-full h-auto rounded-lg my-2 border border-primary-200 dark:border-primary-700"
        onError={(e) => {
          const target = e.currentTarget;
          if (src && target.src !== src) target.src = src;
        }}
      />
    );
  },
};
