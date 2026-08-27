import { View } from "react-native";

import { parsePromptContent } from "@/lib/prompt-chips";
import type { TranscriptItem } from "@/lib/transcript";
import { colors, radius, spacing, useProviderAccent } from "@/theme";

import { ImageGallery } from "./artifact-image";
import { Markdown } from "./markdown";
import { MessageActions } from "./message-actions";
import { PromptSegmentView } from "./prompt-chips";
import { ThemedText } from "./themed-text";
import { ToolBlock } from "./tools/tool-block";

/**
 * What the action row under an agent message may do. Threaded down from the
 * run screen, which is the only place that knows where the run ends and
 * whether the Mac is in reach.
 */
export interface TranscriptActions {
  /**
   * The run's closing message. It is the one message treated specially: no
   * actions while the run is still writing it, and — once it settles — the
   * only place a fork can branch from.
   */
  closingKey: string | null;
  /** True while the run is still working. */
  isRunLive: boolean;
  /** Branch a new run off this one; absent when the Mac is out of reach. */
  onFork?: () => Promise<void>;
}

/**
 * The agent turn a row belongs to. One action row per turn, under its last
 * message, and what it copies is the whole turn — a turn's earlier messages
 * are its working-out, and reading them back one copy at a time was noise.
 */
export interface TurnActions {
  /** The turn's last agent message: the one that carries the action row. */
  lastResponseKey: string | null;
  /** Every agent message of the turn, in order, a blank line between. */
  text: string;
}

/**
 * One line of a transcript. The user speaks in a bubble tinted with the
 * provider that answered; the agent speaks flush to the column, the way the
 * desktop's transcript does; a tool call is a row that opens.
 */
export function TranscriptRow({
  item,
  providerId,
  actions,
  turn,
}: {
  item: TranscriptItem;
  /** The run's provider — decides the prompt bubble's color. */
  providerId?: string | null;
  /** Absent until the run loads — then the turn's last message gets its row. */
  actions?: TranscriptActions;
  /** Absent for a row outside any agent turn; then a message stands alone. */
  turn?: TurnActions;
}) {
  switch (item.kind) {
    case "prompt":
      return <PromptBubble item={item} providerId={providerId} />;
    case "tools":
      return <ToolBlock calls={item.calls} />;
    case "images":
      return <ImageGallery images={item.images} />;
    case "note":
      return (
        <ThemedText variant="monoCaption" selectable>
          {item.text}
        </ThemedText>
      );
    case "response":
      // "Still working" is the transcript's footer loader, not a badge on the
      // last message — the agent is working on the run, not on that paragraph.
      return <AgentMessage item={item} actions={actions} turn={turn} />;
  }
}

function AgentMessage({
  item,
  actions,
  turn,
}: {
  item: Extract<TranscriptItem, { kind: "response" }>;
  actions?: TranscriptActions;
  turn?: TurnActions;
}) {
  const isClosing = item.key === actions?.closingKey;
  // Only the turn's last message carries the row, and a message the agent is
  // still writing isn't a message yet: no copy of a half-answer, and nothing
  // to fork from until the session settles.
  const isTurnEnd = !turn || item.key === turn.lastResponseKey;
  const showActions = actions && isTurnEnd && !(isClosing && actions.isRunLive);

  return (
    <View style={{ gap: spacing.xs }}>
      <Markdown source={item.text} />
      {showActions ? (
        <MessageActions text={turn?.text ?? item.text} onFork={isClosing ? actions.onFork : undefined} />
      ) : null}
    </View>
  );
}

/** Up to this many characters, a prompt's bubble is too narrow for the full radius. */
const BRIEF_PROMPT_CHARS = 3;

function PromptBubble({
  item,
  providerId,
}: {
  item: Extract<TranscriptItem, { kind: "prompt" }>;
  providerId?: string | null;
}) {
  const accent = useProviderAccent(providerId);
  const { segments } = parsePromptContent(item.text, item.skills, item.files);
  // A word or two makes a bubble about as wide as it is tall, and the full
  // radius turns that into a circle; a brief prompt keeps squarer corners.
  const brief =
    item.skills.length === 0 && item.files.length === 0 && item.text.trim().length <= BRIEF_PROMPT_CHARS;

  return (
    <View style={{ alignItems: "flex-end", paddingVertical: spacing.sm }}>
      <View
        style={{
          maxWidth: "84%",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.ms,
          borderRadius: brief ? radius.lg + 4 : radius.xl,
          borderCurve: "continuous",
          backgroundColor: accent,
        }}
      >
        <ThemedText variant="prose" selectable style={{ color: colors.onTint }}>
          {segments.map((segment, i) => (
            <PromptSegmentView key={i} segment={segment} onAccent />
          ))}
        </ThemedText>
      </View>
    </View>
  );
}
