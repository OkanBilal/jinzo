import { View } from "react-native";

import { parsePromptContent } from "@/lib/prompt-chips";
import type { TranscriptItem } from "@/lib/transcript";
import { colors, radius, spacing, useProviderAccent } from "@/theme";

import { Markdown } from "./markdown";
import { PromptSegmentView } from "./prompt-chips";
import { ThemedText } from "./themed-text";
import { ToolBlock } from "./tools/tool-block";

/**
 * One line of a transcript. The user speaks in a bubble tinted with the
 * provider that answered; the agent speaks flush to the column, the way the
 * desktop's transcript does; a tool call is a row that opens.
 */
export function TranscriptRow({
  item,
  providerId,
}: {
  item: TranscriptItem;
  /** The run's provider — decides the prompt bubble's color. */
  providerId?: string | null;
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
      return <Markdown source={item.text} />;
  }
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
