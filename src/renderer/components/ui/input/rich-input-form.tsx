import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FileIconComponent } from "@/features/workspace/components/file-explorer/components/file-icon";
import { Sparkles } from "@/components/ui/icons";
import { applySignedSrc } from "@/lib/local-image-url";

const sparklesIconMarkup = renderToStaticMarkup(<Sparkles className="w-3 h-3 shrink-0" />);

export interface RichSkillChipData {
  name: string;
  displayName?: string;
  iconSmall?: string;
  iconLarge?: string;
  brandColor?: string;
}

export interface RichFileChipData {
  /** Unique path used as chip identity and serialized as `@<path>`. */
  path: string;
  /** Short label rendered inside the chip. */
  basename: string;
}

export type RichTriggerChar = "/" | "@" | "#" | "$";

export interface RichInputFormHandle {
  focus: () => void;
  /** Replace a leading "<trigger><filter>" token at the caret with an inline skill chip + trailing space. */
  replaceTokenWithSkillChip: (
    triggerChar: "$" | "@" | "/",
    skill: RichSkillChipData,
  ) => void;
  /** Replace a leading "<trigger><filter>" token at the caret with an inline file chip + trailing space. Returns false if the caret was not in a text node (e.g. after focus moved to a dropdown) — caller should fall back to rewriting the query string with `@<path> ` so the sync effect can rebuild the chip. */
  replaceTokenWithFileChip: (
    triggerChar: "@" | "/",
    file: RichFileChipData,
  ) => boolean;
  /** Replace a leading "<trigger><filter>" token at the caret with the given plain-text replacement. Returns false if the caret was not in a text node (e.g. after focus moved to a dropdown). */
  replaceTokenWithText: (triggerChar: RichTriggerChar, replacement: string) => boolean;
}

interface RichInputFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onSkillChipsChange?: (names: string[]) => void;
  onFileChipsChange?: (paths: string[]) => void;
  /** Fires whenever the caret moves or content changes; receives the serialized text from start to caret. */
  onCaretContextChange?: (textBeforeCaret: string) => void;
  placeholder?: string;
  /** Maps skill name → display data so `$<name>` tokens can be rebuilt as chips when query changes externally. */
  skillChipMap?: ReadonlyMap<string, RichSkillChipData>;
  /** Maps file path → display data so `@<path>` tokens can be rebuilt as chips when query changes externally. */
  fileChipMap?: ReadonlyMap<string, RichFileChipData>;
}

const CHIP_ATTR = "data-skill-chip";
const CHIP_NAME_ATTR = "data-skill-name";
const FILE_CHIP_ATTR = "data-file-chip";
const FILE_PATH_ATTR = "data-file-path";
const CHIP_KEY_SEP = "";

function buildChip(skill: RichSkillChipData): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.setAttribute(CHIP_ATTR, "true");
  chip.setAttribute(CHIP_NAME_ATTR, skill.name);
  chip.contentEditable = "false";
  // Fixed height + leading-none + align-middle so the line box height stays constant
  // regardless of whether the chip carries an icon — keeps the caret height consistent.
  chip.className =
    "inline-flex align-middle items-center gap-1 px-1.5 mb-0.5 h-6 mx-0.5 rounded-lg text-xs font-medium leading-none select-none " +
    "bg-primary dark:bg-primary-300/10 dark:text-primary-200 " +
    " cursor-default";

  // Icon slot is always present (even as an empty 14×14 spacer) so chip width/height stay stable.
  const iconSlot = document.createElement("span");
  iconSlot.className =
    "inline-flex items-center justify-center size-3.5 shrink-0 rounded-sm overflow-hidden";

  const iconPath = skill.iconLarge || skill.iconSmall;
  if (iconPath) {
    const img = document.createElement("img");
    img.alt = "";
    img.className = "size-full object-contain";
    if (skill.brandColor) {
      img.style.backgroundColor = skill.brandColor;
    }
    img.draggable = false;
    img.onerror = () => {
      // Swap to the Sparkles placeholder so a missing asset doesn't render a broken-image glyph.
      img.remove();
      iconSlot.innerHTML = sparklesIconMarkup;
    };
    iconSlot.appendChild(img);
    applySignedSrc(img, iconPath);
  } else {
    iconSlot.innerHTML = sparklesIconMarkup;
  }
  chip.appendChild(iconSlot);

  const label = document.createElement("span");
  label.className = "leading-none";
  label.textContent = skill.displayName || skill.name;
  chip.appendChild(label);

  return chip;
}

const fileIconMarkupCache = new Map<string, string>();

function getFileIconMarkup(basename: string): string {
  const cacheKey = basename;
  const cached = fileIconMarkupCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const dotIdx = basename.lastIndexOf(".");
  const extension = dotIdx > 0 && dotIdx < basename.length - 1 ? basename.slice(dotIdx + 1) : undefined;
  const markup = renderToStaticMarkup(
    <FileIconComponent extension={extension} fileName={basename} className="size-3.5" />,
  );
  fileIconMarkupCache.set(cacheKey, markup);
  return markup;
}

function buildFileChip(file: RichFileChipData): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.setAttribute(FILE_CHIP_ATTR, "true");
  chip.setAttribute(FILE_PATH_ATTR, file.path);
  chip.contentEditable = "false";
  chip.title = file.path;
  chip.className =
    "inline-flex align-middle items-center gap-1 px-1.5 mb-0.5 h-6 mx-0.5 rounded-lg text-xs font-medium leading-none select-none " +
    "bg-primary dark:bg-primary-300/10 dark:text-primary-200 cursor-default";

  const iconSlot = document.createElement("span");
  iconSlot.className = "inline-flex items-center justify-center size-3.5 shrink-0";
  iconSlot.innerHTML = getFileIconMarkup(file.basename);
  chip.appendChild(iconSlot);

  const label = document.createElement("span");
  label.className = "leading-none";
  label.textContent = file.basename;
  chip.appendChild(label);

  return chip;
}

/**
 * Serialize the editor DOM to plain text. Skill chips are rendered as `$<name>` tokens
 * and file chips as `@<path>` tokens so external menu detection regexes still work and
 * the goal string survives a round trip.
 */
function serializeRoot(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (node instanceof HTMLElement) {
      if (node.getAttribute(CHIP_ATTR) === "true") {
        out += "$" + (node.getAttribute(CHIP_NAME_ATTR) ?? "");
        return;
      }
      if (node.getAttribute(FILE_CHIP_ATTR) === "true") {
        out += "@" + (node.getAttribute(FILE_PATH_ATTR) ?? "");
        return;
      }
      if (node.tagName === "BR") {
        out += "\n";
        return;
      }
      if (node.tagName === "DIV" && out.length > 0 && !out.endsWith("\n")) {
        out += "\n";
      }
      for (const child of Array.from(node.childNodes)) walk(child);
    }
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  return out;
}

function rebuildContent(
  root: HTMLElement,
  text: string,
  skillChipMap?: ReadonlyMap<string, RichSkillChipData>,
  fileChipMap?: ReadonlyMap<string, RichFileChipData>,
) {
  while (root.firstChild) root.removeChild(root.firstChild);
  if (text.length === 0) return;

  const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const skillNames =
    skillChipMap && skillChipMap.size > 0
      ? Array.from(skillChipMap.keys()).sort((a, b) => b.length - a.length)
      : [];
  const filePaths =
    fileChipMap && fileChipMap.size > 0
      ? Array.from(fileChipMap.keys()).sort((a, b) => b.length - a.length)
      : [];

  if (skillNames.length === 0 && filePaths.length === 0) {
    root.appendChild(document.createTextNode(text));
    return;
  }

  // Longer paths sorted first so `@src/foo.tsx.bak` wins over `@src/foo.tsx` when both are present.
  const parts: string[] = [];
  if (skillNames.length > 0) {
    parts.push(`\\$(?<skill>${skillNames.map(escRe).join("|")})(?![\\w-])`);
  }
  if (filePaths.length > 0) {
    // Negative lookahead allows path chars (`.`, `/`, `-`, `_`, word) so we don't partial-match a longer path.
    parts.push(`@(?<file>${filePaths.map(escRe).join("|")})(?![\\w./-])`);
  }
  const re = new RegExp(parts.join("|"), "g");

  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      root.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
    }
    const skillName = match.groups?.skill;
    const filePath = match.groups?.file;
    if (skillName) {
      const data = skillChipMap!.get(skillName);
      root.appendChild(data ? buildChip(data) : document.createTextNode(match[0]));
    } else if (filePath) {
      const data = fileChipMap!.get(filePath);
      root.appendChild(data ? buildFileChip(data) : document.createTextNode(match[0]));
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    root.appendChild(document.createTextNode(text.slice(lastIdx)));
  }
}

function serializeFragment(node: Node): string {
  let out = "";
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.textContent ?? "";
      return;
    }
    if (n instanceof HTMLElement) {
      if (n.getAttribute(CHIP_ATTR) === "true") {
        out += "$" + (n.getAttribute(CHIP_NAME_ATTR) ?? "");
        return;
      }
      if (n.getAttribute(FILE_CHIP_ATTR) === "true") {
        out += "@" + (n.getAttribute(FILE_PATH_ATTR) ?? "");
        return;
      }
      if (n.tagName === "BR") {
        out += "\n";
        return;
      }
      if (n.tagName === "DIV" && out.length > 0 && !out.endsWith("\n")) {
        out += "\n";
      }
      for (const c of Array.from(n.childNodes)) walk(c);
      return;
    }
    for (const c of Array.from(n.childNodes)) walk(c);
  };
  walk(node);
  return out;
}

function getTextBeforeCaret(root: HTMLElement): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return null;
  const before = document.createRange();
  before.setStart(root, 0);
  before.setEnd(range.endContainer, range.endOffset);
  const fragment = before.cloneContents();
  return serializeFragment(fragment);
}

/**
 * Find the most recent `triggerChar` before the caret and replace [trigger..caret] with
 * either a chip + trailing space, or a plain-text replacement. Returns true on success.
 */
function replaceTokenAtCaret(
  root: HTMLElement,
  triggerChar: string,
  replacement: { kind: "text"; value: string } | { kind: "chip"; chip: HTMLElement },
): boolean {
  root.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return false;
  const node = range.endContainer;
  if (node.nodeType !== Node.TEXT_NODE) return false;
  const text = node.textContent ?? "";
  const offset = range.endOffset;
  const before = text.slice(0, offset);
  const triggerIdx = before.lastIndexOf(triggerChar);
  if (triggerIdx < 0) return false;

  const tokenRange = document.createRange();
  tokenRange.setStart(node, triggerIdx);
  tokenRange.setEnd(node, offset);
  tokenRange.deleteContents();

  if (replacement.kind === "text") {
    const txt = document.createTextNode(replacement.value);
    tokenRange.insertNode(txt);
    const after = document.createRange();
    after.setStartAfter(txt);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
  } else {
    const space = document.createTextNode(" ");
    tokenRange.insertNode(space);
    tokenRange.insertNode(replacement.chip);
    const after = document.createRange();
    after.setStartAfter(space);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
  }
  return true;
}

function collectChipNames(root: HTMLElement): string[] {
  const names: string[] = [];
  for (const el of Array.from(root.querySelectorAll(`[${CHIP_ATTR}="true"]`))) {
    const name = el.getAttribute(CHIP_NAME_ATTR);
    if (name) names.push(name);
  }
  return names;
}

function collectFileChipPaths(root: HTMLElement): string[] {
  const paths: string[] = [];
  for (const el of Array.from(root.querySelectorAll(`[${FILE_CHIP_ATTR}="true"]`))) {
    const p = el.getAttribute(FILE_PATH_ATTR);
    if (p) paths.push(p);
  }
  return paths;
}

export const RichInputForm = forwardRef<RichInputFormHandle, RichInputFormProps>(
  function RichInputForm(
    {
      query,
      onQueryChange,
      onSubmit,
      onSkillChipsChange,
      onFileChipsChange,
      onCaretContextChange,
      placeholder,
      skillChipMap,
      fileChipMap,
    },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const [isEmpty, setIsEmpty] = useState(query.length === 0);
    // Sentinel that no real query string can equal — forces an initial DOM rebuild on mount.
    const lastSerializedRef = useRef<string>(" __rif_init__");
    const lastChipsRef = useRef<string>("");
    const lastFileChipsRef = useRef<string>("");
    const skillChipMapRef = useRef<ReadonlyMap<string, RichSkillChipData> | undefined>(skillChipMap);
    const fileChipMapRef = useRef<ReadonlyMap<string, RichFileChipData> | undefined>(fileChipMap);
    useEffect(() => {
      skillChipMapRef.current = skillChipMap;
    }, [skillChipMap]);
    useEffect(() => {
      fileChipMapRef.current = fileChipMap;
    }, [fileChipMap]);

    const fireCaretContext = useCallback(() => {
      if (!onCaretContextChange) return;
      const root = editorRef.current;
      if (!root) return;
      const before = getTextBeforeCaret(root);
      if (before === null) return;
      onCaretContextChange(before);
    }, [onCaretContextChange]);

    // Re-evaluate caret context on caret moves without input (arrow keys, mouse clicks).
    useEffect(() => {
      if (!onCaretContextChange) return;
      const handler = () => {
        const root = editorRef.current;
        if (!root) return;
        if (document.activeElement !== root) return;
        fireCaretContext();
      };
      document.addEventListener("selectionchange", handler);
      return () => document.removeEventListener("selectionchange", handler);
    }, [onCaretContextChange, fireCaretContext]);

    const fireChange = useCallback(() => {
      const root = editorRef.current;
      if (!root) return;
      const text = serializeRoot(root);
      lastSerializedRef.current = text;
      setIsEmpty(text.length === 0);
      if (text !== query) onQueryChange(text);

      if (onSkillChipsChange) {
        const names = collectChipNames(root);
        const key = names.join(CHIP_KEY_SEP);
        if (key !== lastChipsRef.current) {
          lastChipsRef.current = key;
          onSkillChipsChange(names);
        }
      }

      if (onFileChipsChange) {
        const paths = collectFileChipPaths(root);
        const key = paths.join(CHIP_KEY_SEP);
        if (key !== lastFileChipsRef.current) {
          lastFileChipsRef.current = key;
          onFileChipsChange(paths);
        }
      }

      fireCaretContext();
    }, [onQueryChange, onSkillChipsChange, onFileChipsChange, query, fireCaretContext]);

    // Sync DOM when external `query` differs from current serialization.
    // Only fires on real divergence (slash/file/issue picker rewrites the goal); typing leaves them in lockstep.
    useEffect(() => {
      const root = editorRef.current;
      if (!root) return;
      if (query === lastSerializedRef.current) return;
      rebuildContent(root, query, skillChipMapRef.current, fileChipMapRef.current);
      lastSerializedRef.current = query;
      setIsEmpty(query.length === 0);

      const names = collectChipNames(root);
      lastChipsRef.current = names.join(CHIP_KEY_SEP);
      onSkillChipsChange?.(names);

      const paths = collectFileChipPaths(root);
      lastFileChipsRef.current = paths.join(CHIP_KEY_SEP);
      onFileChipsChange?.(paths);

      if (document.activeElement === root) placeCaretAtEnd(root);
    }, [query, onSkillChipsChange, onFileChipsChange]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editorRef.current?.focus(),
        replaceTokenWithSkillChip: (triggerChar, skill) => {
          const root = editorRef.current;
          if (!root) return;
          const chip = buildChip(skill);
          if (replaceTokenAtCaret(root, triggerChar, { kind: "chip", chip })) {
            fireChange();
            return;
          }
          // No matching trigger before the caret — insert chip wherever the caret sits, or at end.
          root.focus();
          const sel = window.getSelection();
          if (
            !sel ||
            sel.rangeCount === 0 ||
            !root.contains(sel.getRangeAt(0).endContainer)
          ) {
            root.appendChild(chip);
            root.appendChild(document.createTextNode(" "));
            placeCaretAtEnd(root);
            fireChange();
            return;
          }
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const space = document.createTextNode(" ");
          range.insertNode(space);
          range.insertNode(chip);
          const after = document.createRange();
          after.setStartAfter(space);
          after.collapse(true);
          sel.removeAllRanges();
          sel.addRange(after);
          fireChange();
        },
        replaceTokenWithFileChip: (triggerChar, file) => {
          const root = editorRef.current;
          if (!root) return false;
          const chip = buildFileChip(file);
          if (replaceTokenAtCaret(root, triggerChar, { kind: "chip", chip })) {
            fireChange();
            return true;
          }
          // Caret left the editor (dropdown focus); caller should rewrite the query string instead.
          return false;
        },
        replaceTokenWithText: (triggerChar, replacement) => {
          const root = editorRef.current;
          if (!root) return false;
          const ok = replaceTokenAtCaret(root, triggerChar, { kind: "text", value: replacement });
          if (ok) fireChange();
          return ok;
        },
      }),
      [fireChange],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      },
      [onSubmit],
    );

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      const after = document.createRange();
      after.setStartAfter(node);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
      fireChange();
    }, [fireChange]);

    return (
      <div className="relative">
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label="Workspace prompt input"
          contentEditable
          suppressContentEditableWarning
          onInput={fireChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="rounded-2xl w-full pl-5 pr-24 pt-4 pb-1 text-sm outline-none whitespace-pre-wrap wrap-break-word
            min-h-12 max-h-80 overflow-y-auto noscrollbar
            dark:text-primary-200 text-primary-700"
        />
        {isEmpty && placeholder && (
          <div className="pointer-events-none absolute left-5 top-4 text-sm text-primary-600 dark:text-primary-400">
            {placeholder}
          </div>
        )}
        <kbd className="absolute cursor-default right-3 top-3 px-1.5 py-0.5 text-xxs font-sans text-primary-700 dark:text-primary-200">
          ⌘ P to focus
        </kbd>
      </div>
    );
  },
);

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}
