import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface RichSkillChipData {
  name: string;
  displayName?: string;
  iconSmall?: string;
  iconLarge?: string;
  brandColor?: string;
}

export type RichTriggerChar = "/" | "@" | "#" | "$";

export interface RichInputFormHandle {
  focus: () => void;
  /** Replace a leading "$<filter>" token at the caret with an inline skill chip + trailing space. */
  replaceTokenWithSkillChip: (triggerChar: "$", skill: RichSkillChipData) => void;
  /** Replace a leading "<trigger><filter>" token at the caret with the given plain-text replacement. Returns false if the caret was not in a text node (e.g. after focus moved to a dropdown). */
  replaceTokenWithText: (triggerChar: RichTriggerChar, replacement: string) => boolean;
}

interface RichInputFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onSkillChipsChange?: (names: string[]) => void;
  /** Fires whenever the caret moves or content changes; receives the serialized text from start to caret. */
  onCaretContextChange?: (textBeforeCaret: string) => void;
  placeholder?: string;
  /** Maps skill name → display data so `$<name>` tokens can be rebuilt as chips when query changes externally. */
  chipMap?: ReadonlyMap<string, RichSkillChipData>;
}

const CHIP_ATTR = "data-skill-chip";
const CHIP_NAME_ATTR = "data-skill-name";
const CHIP_KEY_SEP = "";

function localImageUrl(absPath: string): string {
  return `mains-localimg://img/?path=${encodeURIComponent(absPath)}`;
}

function buildChip(skill: RichSkillChipData): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.setAttribute(CHIP_ATTR, "true");
  chip.setAttribute(CHIP_NAME_ATTR, skill.name);
  chip.contentEditable = "false";
  // Fixed height + leading-none + align-middle so the line box height stays constant
  // regardless of whether the chip carries an icon — keeps the caret height consistent.
  chip.className =
    "inline-flex align-middle items-center gap-1 px-1.5 h-6 mx-0.5 rounded-lg text-xs font-medium leading-none select-none " +
    "bg-primary dark:bg-primary-300/10 dark:text-primary-200 " +
    " cursor-default";

  // Icon slot is always present (even as an empty 14×14 spacer) so chip width/height stay stable.
  const iconSlot = document.createElement("span");
  iconSlot.className =
    "inline-flex items-center justify-center size-3.5 shrink-0 rounded-sm overflow-hidden";

  const iconPath = skill.iconLarge || skill.iconSmall;
  if (iconPath) {
    const img = document.createElement("img");
    img.src = localImageUrl(iconPath);
    img.alt = "";
    img.className = "size-full object-contain";
    if (skill.brandColor) {
      img.style.backgroundColor = skill.brandColor;
    }
    img.draggable = false;
    img.onerror = () => {
      // Swap to the no-icon placeholder so a missing asset doesn't render a broken-image glyph.
      img.remove();
      iconSlot.classList.add("bg-primary-500/30", "dark:bg-primary-500/40");
    };
    iconSlot.appendChild(img);
  } else {
    iconSlot.classList.add("bg-primary-500/30", "dark:bg-primary-500/40");
  }
  chip.appendChild(iconSlot);

  const label = document.createElement("span");
  label.className = "leading-none";
  label.textContent = skill.displayName || skill.name;
  chip.appendChild(label);

  return chip;
}

/**
 * Serialize the editor DOM to plain text. Skill chips are rendered as `$<name>` tokens
 * so external slash-menu detection regexes still work and the goal string survives a round trip.
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
  chipMap?: ReadonlyMap<string, RichSkillChipData>,
) {
  while (root.firstChild) root.removeChild(root.firstChild);
  if (!chipMap || chipMap.size === 0 || text.length === 0) {
    if (text.length > 0) root.appendChild(document.createTextNode(text));
    return;
  }
  const names = Array.from(chipMap.keys()).sort((a, b) => b.length - a.length);
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\$(${escaped.join("|")})(?![\\w-])`, "g");
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      root.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
    }
    const data = chipMap.get(match[1]);
    if (data) {
      root.appendChild(buildChip(data));
    } else {
      root.appendChild(document.createTextNode(match[0]));
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

export const RichInputForm = forwardRef<RichInputFormHandle, RichInputFormProps>(
  function RichInputForm(
    {
      query,
      onQueryChange,
      onSubmit,
      onSkillChipsChange,
      onCaretContextChange,
      placeholder,
      chipMap,
    },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const [isEmpty, setIsEmpty] = useState(query.length === 0);
    // Sentinel that no real query string can equal — forces an initial DOM rebuild on mount.
    const lastSerializedRef = useRef<string>(" __rif_init__");
    const lastChipsRef = useRef<string>("");
    const chipMapRef = useRef<ReadonlyMap<string, RichSkillChipData> | undefined>(chipMap);
    useEffect(() => {
      chipMapRef.current = chipMap;
    }, [chipMap]);

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

      fireCaretContext();
    }, [onQueryChange, onSkillChipsChange, query, fireCaretContext]);

    // Sync DOM when external `query` differs from current serialization.
    // Only fires on real divergence (slash/file/issue picker rewrites the goal); typing leaves them in lockstep.
    useEffect(() => {
      const root = editorRef.current;
      if (!root) return;
      if (query === lastSerializedRef.current) return;
      rebuildContent(root, query, chipMapRef.current);
      lastSerializedRef.current = query;
      setIsEmpty(query.length === 0);

      const names = collectChipNames(root);
      lastChipsRef.current = names.join(CHIP_KEY_SEP);
      onSkillChipsChange?.(names);

      if (document.activeElement === root) placeCaretAtEnd(root);
    }, [query, onSkillChipsChange]);

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
          className="rounded-2xl w-full pl-5 pr-20 pt-4 pb-1 text-sm outline-none whitespace-pre-wrap wrap-break-word
            min-h-12 max-h-80 overflow-y-auto noscrollbar
            dark:text-primary-200 text-primary-700"
        />
        {isEmpty && placeholder && (
          <div className="pointer-events-none absolute left-5 top-4 text-sm text-primary-500 dark:text-primary-500">
            {placeholder}
          </div>
        )}
        <kbd className="absolute cursor-default right-4 top-4 px-1.5 py-0.5 text-xxs font-sans text-primary-400 dark:text-primary-300">
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
