import { View } from "react-native";

import { parsePromptContent } from "@/lib/prompt-chips";
import type { TranscriptItem } from "@/lib/transcript";
import { colors, radius, spacing, useProviderAccent } from "@/theme";

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
 * One line of a transcript. The user speaks in a bubble tinted with the
 * provider that answered; the agent speaks flush to the column, the way the
 * desktop's transcript does; a tool call is a row that opens.
 */
export function TranscriptRow({
  item,
  providerId,
  actions,
}: {
  item: TranscriptItem;
  /** The run's provider — decides the prompt bubble's color. */
  providerId?: string | null;
  /** Absent until the run loads — then every agent message gets its row. */
  actions?: TranscriptActions;
}) {
  switch (item.kind) {
    case "prompt":
      return <PromptBubble item={item} providerId={providerId} />;
    case "tools":
      return <ToolBlock calls={item.calls} />;
    case "note":
      return (
        <ThemedText variant="monoCaption" selectable>
          {item.text}
        </ThemedText>
      );
    case "response":
      // "Still working" is the transcript's footer loader, not a badge on the
      // last message — the agent is working on the run, not on that paragraph.
      return <AgentMessage item={item} actions={actions} />;
  }
}

function AgentMessage({
  item,
  actions,
}: {
  item: Extract<TranscriptItem, { kind: "response" }>;
  actions?: TranscriptActions;
}) {
  const isClosing = item.key === actions?.closingKey;
  // A message the agent is still writing isn't a message yet: no copy of a
  // half-answer, and nothing to fork from until the session settles.
  const showActions = actions && !(isClosing && actions.isRunLive);

  return (
    <View style={{ gap: spacing.xs }}>
      <Markdown source={item.text} />
      {showActions ? (
        <MessageActions text={item.text} onFork={isClosing ? actions.onFork : undefined} />
      ) : null}
    </View>
  );
}

function PromptBubble({
  item,
  providerId,
}: {
  item: Extract<TranscriptItem, { kind: "prompt" }>;
  providerId?: string | null;
}) {
  const accent = useProviderAccent(providerId);
  const { segments } = parsePromptContent(item.text, item.skills, item.files);

  return (
    <View style={{ alignItems: "flex-end", paddingVertical: spacing.sm }}>
      <View
        style={{
          maxWidth: "84%",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.ms,
          borderRadius: radius.xl,
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
