import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import type { PendingApprovalRow } from "@/db/schema";
import { toolInputPreview } from "@/lib/format";
import { colors, radius, shadows, spacing, type, useBrandColors } from "@/theme";

import { Button } from "./button";
import { ThemedText } from "./themed-text";

export function approvalKindLabel(kind: string): string {
  switch (kind) {
    case "ask_user":
      return "Question";
    case "elicitation":
      return "Input needed";
    default:
      return "Approval";
  }
}

export function formatRemaining(expiresAt: Date, now: number): string {
  const total = Math.max(0, Math.ceil((expiresAt.getTime() - now) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseOptions(json: string | null): { label: string; description?: string }[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((o): o is { label: string; description?: string } =>
          !!o && typeof o === "object" && typeof (o as { label?: unknown }).label === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** What the card hands back; the session turns it into `runs:toolApprovalResponse`. */
export type ApprovalDecision = { approved: boolean; answer?: string };

/**
 * An agent request waiting on the user, with the answer surface the desktop's
 * dialog offers — allow/deny for a tool, options or free text for a question,
 * open-and-accept for a URL elicitation. Form elicitations (schema-driven
 * fields) stay on the Mac for now; the card can only decline them.
 */
export function PendingApprovalCard({
  approval,
  now,
  runTitle,
  compact = false,
  onPress,
  onRespond,
}: {
  approval: PendingApprovalRow;
  now: number;
  /** Shown on the overview so the card says which run is asking. */
  runTitle?: string | null;
  compact?: boolean;
  onPress?: () => void;
  /** Absent → read-only card. */
  onRespond?: (decision: ApprovalDecision) => Promise<void>;
}) {
  const brand = useBrandColors();
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = parseOptions(approval.optionsJson);
  const preview = toolInputPreview(approval.toolInputJson, compact ? 70 : 160);
  const title =
    approval.kind === "tool_approval"
      ? approval.toolName
      : approval.header || approval.question || approval.toolName;
  const isForm = approval.kind === "elicitation" && approval.elicitationMode !== "url";

  const respond = async (label: string, decision: ApprovalDecision) => {
    if (!onRespond || sending) return;
    setSending(label);
    setError(null);
    try {
      await onRespond(decision);
      if (process.env.EXPO_OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the answer");
      if (process.env.EXPO_OS === "ios") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setSending(null);
    }
  };

  const toggleOption = (label: string) => {
    setSelected((current) =>
      approval.multiSelect
        ? current.includes(label)
          ? current.filter((l) => l !== label)
          : [...current, label]
        : current.includes(label)
          ? []
          : [label],
    );
  };

  const questionAnswer =
    selected.length > 0 ? selected.join(", ") : freeText.trim().length > 0 ? freeText.trim() : null;

  const footnote = !onRespond
    ? "Answer on your Mac"
    : isForm
      ? "Fill this form in on your Mac — the phone can only decline it."
      : compact && approval.kind !== "tool_approval"
        ? "Open the run to answer"
        : `The Mac denies this in ${formatRemaining(approval.expiresAt, now)}`;

  const body = (
    <View
      style={{
        backgroundColor: colors.groupedCell,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        boxShadow: shadows.card,
        padding: compact ? spacing.ms : spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs + 1,
            borderRadius: radius.full,
            backgroundColor: brand.accentSoft,
          }}
        >
          <ThemedText variant="caption" style={{ color: brand.accent, fontWeight: "600" }}>
            {approvalKindLabel(approval.kind)}
          </ThemedText>
        </View>
        <ThemedText variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {formatRemaining(approval.expiresAt, now)}
        </ThemedText>
      </View>

      {runTitle !== undefined && (
        <ThemedText variant="caption" numberOfLines={1}>
          {runTitle?.trim() || "Untitled run"}
        </ThemedText>
      )}

      <ThemedText variant="headline" numberOfLines={compact ? 2 : undefined}>
        {title}
      </ThemedText>
      {!compact && approval.kind !== "tool_approval" && approval.header && approval.question ? (
        <ThemedText variant="callout">{approval.question}</ThemedText>
      ) : null}
      {preview ? (
        <ThemedText variant="mono" numberOfLines={compact ? 1 : 3} selectable>
          {preview}
        </ThemedText>
      ) : null}
      {!compact && approval.description ? (
        <ThemedText variant="subhead">{approval.description}</ThemedText>
      ) : null}

      {/* ── Answer surface ── */}
      {onRespond && approval.kind === "tool_approval" && (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
          <Button
            title="Deny"
            variant="secondary"
            size="sm"
            loading={sending === "deny"}
            disabled={sending !== null}
            onPress={() => void respond("deny", { approved: false })}
          />
          <Button
            title="Allow"
            size="sm"
            loading={sending === "allow"}
            disabled={sending !== null}
            onPress={() => void respond("allow", { approved: true })}
          />
        </View>
      )}

      {onRespond && approval.kind === "ask_user" && !compact && (
        <>
          {options.length > 0 && (
            <View style={{ gap: spacing.xs + 2 }}>
              {options.map((option) => {
                const active = selected.includes(option.label);
                return (
                  <Pressable
                    key={option.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    disabled={sending !== null}
                    onPress={() => toggleOption(option.label)}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.ms,
                      paddingVertical: spacing.sm + 2,
                      borderRadius: radius.md,
                      borderCurve: "continuous",
                      backgroundColor: active ? brand.accentSoft : colors.fill,
                      opacity: pressed ? 0.7 : 1,
                      gap: spacing.xxs,
                    })}
                  >
                    <ThemedText
                      variant="callout"
                      style={{ fontWeight: "500", color: active ? brand.accent : colors.label }}
                    >
                      {option.label}
                    </ThemedText>
                    {option.description ? (
                      <ThemedText variant="footnote">{option.description}</ThemedText>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
          {(options.length === 0 || approval.isOther) && (
            <TextInput
              accessibilityLabel="Your answer"
              editable={sending === null}
              multiline
              onChangeText={setFreeText}
              placeholder={options.length > 0 ? "Or type a custom answer…" : "Type your answer…"}
              placeholderTextColor={colors.tertiaryLabel as string}
              secureTextEntry={approval.isSecret}
              style={[
                type.callout,
                {
                  minHeight: 44,
                  paddingHorizontal: spacing.ms,
                  paddingVertical: spacing.sm + 2,
                  borderRadius: radius.md,
                  borderCurve: "continuous",
                  backgroundColor: colors.fill,
                  color: colors.label,
                  textAlignVertical: "top",
                },
              ]}
              value={freeText}
            />
          )}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
            <Button
              title="Dismiss"
              variant="ghost"
              size="sm"
              loading={sending === "dismiss"}
              disabled={sending !== null}
              onPress={() => void respond("dismiss", { approved: false })}
            />
            <Button
              title="Send"
              size="sm"
              loading={sending === "send"}
              disabled={sending !== null || questionAnswer === null}
              onPress={() =>
                questionAnswer !== null &&
                void respond("send", { approved: true, answer: questionAnswer })
              }
            />
          </View>
        </>
      )}

      {onRespond && approval.kind === "elicitation" && !compact && (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
          <Button
            title="Decline"
            variant="destructive"
            size="sm"
            loading={sending === "decline"}
            disabled={sending !== null}
            onPress={() => void respond("decline", { approved: false })}
          />
          {!isForm && approval.url ? (
            <Button
              title="Open & accept"
              size="sm"
              loading={sending === "accept"}
              disabled={sending !== null}
              onPress={() => {
                void Linking.openURL(approval.url as string).catch(() => {});
                void respond("accept", { approved: true });
              }}
            />
          ) : null}
        </View>
      )}

      {error ? (
        <ThemedText variant="footnote" style={{ color: colors.systemRed }} selectable>
          {error}
        </ThemedText>
      ) : null}
      <ThemedText variant="caption2">{footnote}</ThemedText>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      {body}
    </Pressable>
  );
}
