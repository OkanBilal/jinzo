import { useRouter, type Href } from "expo-router";
import { Pressable, View } from "react-native";

import type { RunRow as RunRecord } from "@/db/schema";
import { relativeTime, runStatusLabel } from "@/lib/format";
import { colors, radius, spacing } from "@/theme";

import { StatusDot } from "./status";
import { ThemedText } from "./themed-text";

/** One run in a list: status dot, title, workspace · mode, and when. */
export function RunRow({
  run,
  workspaceName,
  onNavigate,
  grouped = true,
}: {
  run: RunRecord;
  workspaceName?: string;
  /** Extra work when the row is tapped (e.g. closing the sidebar). */
  onNavigate?: () => void;
  /** Grouped cells (inside a rounded container) vs plain rows (sidebar). */
  grouped?: boolean;
}) {
  const router = useRouter();
  const live = run.status === "running" || run.status === "queued";
  const meta = [workspaceName, run.mode].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        onNavigate?.();
        router.push(`/run/${run.id}` as Href);
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.ms,
        paddingVertical: spacing.ms,
        paddingHorizontal: grouped ? spacing.md : spacing.sm,
        borderRadius: grouped ? 0 : radius.sm,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.fill : "transparent",
      })}
    >
      <StatusDot status={run.status} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <ThemedText variant="body" numberOfLines={1} style={{ fontWeight: "500" }}>
          {run.title?.trim() || "Untitled run"}
        </ThemedText>
        {meta ? (
          <ThemedText variant="footnote" numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
        {live ? runStatusLabel(run.status) : relativeTime(run.updatedAt)}
      </ThemedText>
    </Pressable>
  );
}
