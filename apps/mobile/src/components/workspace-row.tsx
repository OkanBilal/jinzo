import { Pressable, View } from "react-native";

import type { WorkspaceRow as WorkspaceRecord } from "@/db/schema";
import { relativeTime, workspaceStatusLabel } from "@/lib/format";
import { colors, radius, spacing, type } from "@/theme";

import { ProjectIcon } from "./project-icon";
import { ThemedText } from "./themed-text";
import { WorkspaceStatusIcon } from "./workspace-status-icon";

/** The desktop's diff colors (`text-success` / `text-danger`). */
const ADDITIONS = "#22C55E";
const DELETIONS = "#ff4436";

/**
 * One workspace in the Code sidebar, as the desktop's workspace item: its
 * project's icon and name on the first line; the status glyph and current
 * branch on the second; the last diff's size on the right, or when it last
 * moved if there is no diff yet.
 */
export function WorkspaceRow({
  workspace,
  projectIcon,
  selected = false,
  onPress,
}: {
  workspace: WorkspaceRecord;
  projectIcon: string | null;
  selected?: boolean;
  onPress: () => void;
}) {
  const detail = !workspace.pathExists
    ? "Folder missing"
    : (workspace.branch ?? workspaceStatusLabel(workspace.status) ?? null);
  const hasDiff = workspace.diffAdditions !== null || workspace.diffDeletions !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={[workspace.name, workspaceStatusLabel(workspace.status), workspace.branch]
        .filter(Boolean)
        .join(", ")}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.ms,
        paddingVertical: spacing.ms,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.sm,
        borderCurve: "continuous",
        backgroundColor: pressed || selected ? colors.fill : "transparent",
      })}
    >
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: 18, alignItems: "center" }}>
            <ProjectIcon icon={projectIcon} size={16} color={colors.secondaryLabel} />
          </View>
          <ThemedText variant="body" numberOfLines={1} style={{ flex: 1, fontWeight: "500" }}>
            {workspace.name}
          </ThemedText>
        </View>
        {detail ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ width: 18, alignItems: "center" }}>
              <WorkspaceStatusIcon status={workspace.status} size={14} />
            </View>
            <ThemedText
              variant="footnote"
              numberOfLines={1}
              style={{ flex: 1, color: workspace.pathExists ? colors.secondaryLabel : DELETIONS }}
            >
              {detail}
            </ThemedText>
          </View>
        ) : null}
      </View>
      {hasDiff ? (
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {workspace.diffAdditions !== null && (
            <ThemedText variant="caption" style={[type.mono, { color: ADDITIONS, fontVariant: ["tabular-nums"] }]}>
              +{workspace.diffAdditions}
            </ThemedText>
          )}
          {workspace.diffDeletions !== null && (
            <ThemedText variant="caption" style={[type.mono, { color: DELETIONS, fontVariant: ["tabular-nums"] }]}>
              −{workspace.diffDeletions}
            </ThemedText>
          )}
        </View>
      ) : (
        <ThemedText variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {relativeTime(workspace.updatedAt)}
        </ThemedText>
      )}
    </Pressable>
  );
}
