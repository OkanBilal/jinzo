import { View } from "react-native";

import type { ToolCallRow } from "@/db/schema";
import { toolInputPreview } from "@/lib/format";
import type { TranscriptItem } from "@/lib/transcript";
import { colors, radius, spacing, useBrandColors } from "@/theme";

import { StatusDot } from "./status";
import { ThemedText } from "./themed-text";

export function TranscriptRow({ item }: { item: TranscriptItem }) {
  switch (item.kind) {
    case "prompt":
      return <PromptBubble text={item.text} />;
    case "tool":
      return <ToolCallLine call={item.call} />;
    case "note":
      return (
        <ThemedText variant="monoCaption" selectable>
          {item.text}
        </ThemedText>
      );
    case "response":
      return (
        <View style={{ gap: spacing.xs }}>
          {item.live && (
            <ThemedText variant="caption2" style={{ fontWeight: "600", letterSpacing: 0.6 }}>
              WORKING…
            </ThemedText>
          )}
          {item.text ? (
            <ThemedText variant="body" selectable>
              {item.text}
            </ThemedText>
          ) : null}
        </View>
      );
  }
}

function PromptBubble({ text }: { text: string }) {
  const brand = useBrandColors();
  return (
    <View style={{ alignItems: "flex-end" }}>
      <View
        style={{
          maxWidth: "84%",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.ms,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: brand.accent,
        }}
      >
        <ThemedText variant="body" selectable style={{ color: brand.accentContrast }}>
          {text}
        </ThemedText>
      </View>
    </View>
  );
}

function ToolCallLine({ call }: { call: ToolCallRow }) {
  const preview = toolInputPreview(call.inputJson);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
      <View style={{ paddingTop: 6 }}>
        <StatusDot status={call.status} size={6} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <ThemedText variant="mono" numberOfLines={1}>
          <ThemedText variant="mono" style={{ color: colors.label }}>
            {call.toolName}
          </ThemedText>
          {preview ? `  ${preview}` : ""}
        </ThemedText>
        {call.error ? (
          <ThemedText variant="footnote" numberOfLines={2} style={{ color: colors.systemRed }}>
            {call.error}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}
