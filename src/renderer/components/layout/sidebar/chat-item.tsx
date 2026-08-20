import { useRef, useState, type MouseEvent } from "react";
import {
  AsciiSpinner,
  type AsciiSpinnerVariant,
  Button,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSub,
  Text,
} from "@/components/ui";
import { Archive, Option, Project } from "@/components/ui/icons";
import type { Collection, RecentRun } from "@/lib/redux/api";

/** What the row prints — title, else the goal's first line. */
export function chatLabel(run: Pick<RecentRun, "title" | "goal">): string {
  const title = run.title?.trim();
  if (title) return title;
  const goalLine = run.goal?.split("\n").find((line) => line.trim())?.trim();
  if (goalLine) return goalLine;
  return "Untitled chat";
}

/**
 * Run timestamps are typed as numbers but arrive as `Date` locally (Drizzle)
 * and tagged over WebSocket — normalize rather than trust either.
 */
function toEpochMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/** Compact relative age: "now", "5m", "2h", "3d". */
function timeAgo(value: unknown): string | null {
  const ms = toEpochMs(value);
  if (ms === null) return null;
  const delta = Date.now() - ms;
  if (delta < 60_000) return "now";
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface ChatItemProps {
  run: RecentRun;
  variant: AsciiSpinnerVariant;
  isActive: boolean;
  isRecent?: boolean;
  onSelect: () => void;
  /** Archive = the chat's delete affordance; recoverable in Settings → Archive. */
  onArchive: () => void;
  collections: Collection[];
  onMove: (collectionId: string | null) => void;
}

export function ChatItem({
  run,
  variant,
  isActive,
  isRecent = false,
  onSelect,
  onArchive,
  collections,
  onMove,
}: ChatItemProps) {
  const isLive = run.status === "running" || run.status === "queued";
  const age = timeAgo(run.updatedAt);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const openMenu = (event: MouseEvent) => {
    event.stopPropagation();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setMenuPosition({ x: rect.right, y: rect.bottom });
    setIsMenuOpen(true);
  };

  const move = (collectionId: string | null) => {
    setIsMenuOpen(false);
    onMove(collectionId);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`group/chat w-full flex items-center gap-1.5 pr-2.5 py-1 rounded-[10px] cursor-pointer transition-colors ${
          isRecent ? "pl-2.5" : "pl-7"
        } ${
          isActive
            ? "bg-primary/50 glass-outline dark:bg-primary/5"
            : "hover:bg-primary/50 dark:hover:bg-primary/5"
        }`}
      >
        {/* Two homes for one indicator. An indented project row has an empty
            gutter to hang it in, so labels stay aligned whether or not a chat
            is running. A Recents row is flush with the sidebar's edge — hung
            there the spinner lands outside the row, so it takes a place in the
            flow instead and nudges the label across while the run is live. */}
        {isLive && isRecent && (
          // The slot reserves width in the flow; the spinner itself is taken
          // out of it. A box with no in-flow content cannot set the row's
          // height, so a live chat and an idle one measure exactly the same —
          // the same reason the indented rows hang theirs in the gutter.
          <span className="relative shrink-0 w-3 self-stretch">
            <span className="absolute inset-0 flex items-center justify-center">
              <AsciiSpinner variant={variant} kind="circle" />
            </span>
          </span>
        )}
        <span className="relative min-w-0 flex-1">
          {isLive && !isRecent && (
            <span className="pointer-events-none absolute right-full top-1/2 mr-1.5 -translate-y-1/2">
              <AsciiSpinner variant={variant} kind="circle" />
            </span>
          )}
          <Text
            as="span"
            size="s"
            tone={isActive ? "contrast" : "default"}
            className="block truncate"
          >
            {chatLabel(run)}
          </Text>
        </span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {age && (
            <Text
              as="span"
              size="xxs"
              tone="secondary"
              className="tabular-nums group-hover/chat:hidden"
            >
              {age}
            </Text>
          )}
          <Button
            ref={triggerRef}
            tooltip="Chat options"
            onClick={openMenu}
            className="hidden group-hover/chat:flex items-center p-0.5 cursor-pointer rounded-md"
            aria-label="Chat options"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <Option className="w-3.5 h-3.5 text-primary-800 dark:text-primary-200" />
          </Button>
        </div>
      </div>
      <DropdownMenu
        isOpen={isMenuOpen}
        aria-label="Chat actions"
        position={menuPosition}
        origin="top-left"
        onClose={() => setIsMenuOpen(false)}
      >
        <DropdownMenuSub
          label={
            <>
              <Project className="size-3.5" />
              <span>Move</span>
            </>
          }
        >
          <DropdownMenuItem
            selected={run.collectionId === null}
            onClick={() => move(null)}
          >
            Standalone
          </DropdownMenuItem>
          {collections.map((collection) => (
            <DropdownMenuItem
              key={collection.id}
              selected={run.collectionId === collection.id}
              onClick={() => move(collection.id)}
            >
              {collection.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSub>
        <DropdownMenuItem
          variant="danger"
          onClick={() => {
            setIsMenuOpen(false);
            onArchive();
          }}
        >
          <Archive className="size-3.5" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenu>
    </>
  );
}
