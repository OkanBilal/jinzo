import { createPortal } from "react-dom";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Chat, Note } from "@/components/ui/icons";

type SelectedText = {
  text: string;
  top: number;
  left: number;
};

interface ChatSelectionActionsProps {
  containerRef: RefObject<HTMLElement | null>;
  onAddToChat: (text: string) => void;
  onAddToCue: (text: string) => void;
}

function getSelectedText(container: HTMLElement): SelectedText | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) return null;

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return {
    text,
    top: Math.max(12, rect.top - 8),
    left: Math.max(12, Math.min(rect.left, window.innerWidth - 244)),
  };
}

/** Contextual actions for text selected inside the chat transcript only. */
export function ChatSelectionActions({
  containerRef,
  onAddToChat,
  onAddToCue,
}: ChatSelectionActionsProps) {
  const [selected, setSelected] = useState<SelectedText | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const syncSelection = useCallback(() => {
    const container = containerRef.current;
    setSelected(container ? getSelectedText(container) : null);
  }, [containerRef]);

  const dismiss = useCallback(() => {
    setSelected(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", syncSelection);
    window.addEventListener("resize", syncSelection);
    return () => {
      document.removeEventListener("selectionchange", syncSelection);
      window.removeEventListener("resize", syncSelection);
    };
  }, [syncSelection]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      dismiss();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [dismiss]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => setSelected(null);
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [containerRef]);

  if (!selected) return null;

  const handleMouseDown = (event: React.MouseEvent) => event.preventDefault();

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-(--z-dropdown) flex overflow-hidden rounded-xl glass-surface  shadow-xl"
      style={{ left: selected.left, top: selected.top, transform: "translateY(-100%)" }}
      role="toolbar"
      aria-label="Selected text actions"
    >
      <Button
        variant="bare"
        onMouseDown={handleMouseDown}
        onClick={() => {
          onAddToChat(selected.text);
          dismiss();
        }}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-800 transition-colors  dark:text-primary-100"
      >
        <Chat className="size-3.5" />
        Add to chat
      </Button>
      <Button
        variant="bare"
        onMouseDown={handleMouseDown}
        onClick={() => {
          onAddToCue(selected.text);
          dismiss();
        }}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-800 transition-colors  dark:text-primary-100"
      >
        <Note className="size-3.5" />
        Add to Cue
      </Button>
    </div>,
    document.body,
  );
}
