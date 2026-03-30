import { Components } from "react-markdown";

/**
 * Custom ReactMarkdown component overrides for consistent styling.
 */
export const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold mt-4 mb-2 font-sans text-primary-900 dark:text-primary-100 transition-all duration-150 ease-out">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold mt-3 mb-2 font-sans text-primary-900 dark:text-primary-100 transition-all duration-150 ease-out">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1 font-sans text-primary-900 dark:text-primary-100 transition-all duration-150 ease-out">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-2 text-sm leading-relaxed font-sans text-primary-800 dark:text-primary-200 transition-all duration-150 ease-out">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc text-sm list-inside font-sans mb-2 space-y-1 text-primary-800 dark:text-primary-200 transition-all duration-150 ease-out">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal text-sm list-inside font-sans mb-2 space-y-1 text-primary-800 dark:text-primary-200 transition-all duration-150 ease-out">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="ml-2 font-sans text-sm text-primary-800 dark:text-primary-200 transition-all duration-150 ease-out">{children}</li>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-lg border border-primary-300 dark:border-primary-700 transition-all duration-150 ease-out">
      <table className="min-w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-primary-50 dark:bg-primary/10 transition-all duration-150 ease-out">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="bg-primary dark:bg-primary/3 transition-all duration-150 ease-out">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-primary-200 dark:border-primary-700 hover:bg-primary-200/20 dark:hover:bg-primary/5 transition-all duration-150 ease-out">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 text-left text-sm font-semibold font-sans text-primary-900 dark:text-primary-100 border-r border-primary-200 dark:border-primary-700 last:border-r-0 transition-all duration-150 ease-out">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-sm font-sans text-primary-800 dark:text-primary-200 border-r border-primary-200 dark:border-primary-700 last:border-r-0 transition-all duration-150 ease-out">
      {children}
    </td>
  ),
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="px-1 py-0.5 rounded text-primary-900 dark:text-primary-100 text-[0.9em] bg-primary-200/40 dark:bg-primary/4  font-mono transition-all duration-150 ease-out">
          {children}
        </code>
      );
    }
    return (
      <code className="block p-4 rounded-xl bg-primary-50 dark:bg-primary/5 text-primary-900 dark:text-primary-100 text-s font-mono overflow-x-auto transition-all duration-150 ease-out">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 rounded-xl overflow-hidden bg-primary-50 dark:bg-primary/8 transition-all duration-150 ease-out">{children}</pre>
  ),
  a: ({ href, children }) => (
    <button
      type="button"
      onClick={() => {
        if (href) {
          window.api.shell.openExternal(href);
        }
      }}
      className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 underline cursor-pointer transition-all duration-150 ease-out inline"
    >
      {children}
    </button>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary-400 dark:border-primary-600 pl-4 py-1 my-2 italic text-primary-700 dark:text-primary-300 transition-all duration-150 ease-out">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-primary-900 dark:text-primary-100 transition-all duration-150 ease-out">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic text-primary-800 dark:text-primary-200 transition-all duration-150 ease-out">
      {children}
    </em>
  ),
  hr: () => <hr className="my-4 border-primary-300 dark:border-primary-700 transition-all duration-150 ease-out" />,
  img: ({ src, alt }) => {
    const proxiedSrc =
      src && src.startsWith("https://")
        ? `jinzo-img://proxy?url=${encodeURIComponent(src)}`
        : src;
    return (
      <img
        src={proxiedSrc}
        alt={alt || ""}
        className="max-w-full h-auto rounded-lg my-2 border border-primary-200 dark:border-primary-700 transition-all duration-150 ease-out"
        onError={(e) => {
          const target = e.currentTarget;
          if (src && target.src !== src) target.src = src;
        }}
      />
    );
  },
};
