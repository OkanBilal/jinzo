import { useState } from "react";
import { Pressable, View } from "react-native";

import { accordionLabel, type TurnRow } from "@/lib/transcript-rows";
import type { TranscriptItem } from "@/lib/transcript";
import { colors, spacing } from "@/theme";

import { SFSymbol } from "./sf-symbol";
import { ThemedText } from "./themed-text";
import { TranscriptRow } from "./transcript-row";

/**
 * One planned row of the transcript: either a flat run of items, or a turn
 * whose earlier work is folded behind a "2 messages · 6 tool calls" line.
 *
 * The live rule is the desktop's: while the run is still inside this turn the
 * fold is forced open and its header hidden — you watch the work happen — and
 * the moment the turn settles it closes again, with the answer on top.
 */
export function TranscriptTurn({
  row,
  providerId,
  isRunInProgress,
}: {
  row: TurnRow;
  providerId?: string | null;
  /** True only for the last row while the run is still going (see the screen). */
  isRunInProgress: boolean;
}) {
  if (row.kind === "flat") {
    return <ItemList items={row.items} providerId={providerId} />;
  }
  return <TurnAccordion row={row} providerId={providerId} isRunInProgress={isRunInProgress} />;
}

function ItemList({
  items,
  providerId,
}: {
  items: TranscriptItem[];
  providerId?: string | null;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      {items.map((item) => (
        <TranscriptRow key={item.key} item={item} providerId={providerId} />
      ))}
    </View>
  );
}

function TurnAccordion({
  row,
  providerId,
  isRunInProgress,
}: {
  row: Extract<TurnRow, { kind: "accordion" }>;
  providerId?: string | null;
  isRunInProgress: boolean;
}) {
  const [open, setOpen] = useState(false);

  // A turn that goes live drops any earlier manual expansion, so the next
  // settle closes it rather than leaving it stuck open. Adjusted during render
  // off a remembered prop rather than in an effect — the desktop reaches for
  // `queueMicrotask` inside one to dodge the same cascading render.
  const [wasLive, setWasLive] = useState(isRunInProgress);
  if (wasLive !== isRunInProgress) {
    setWasLive(isRunInProgress);
    if (isRunInProgress) setOpen(false);
  }

  const expanded = isRunInProgress || open;
  const label = accordionLabel(row.messageCount, row.toolSummary);

  return (
    <View style={{ gap: spacing.md }}>
      {!isRunInProgress && (
        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.separator, paddingBottom: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((v) => !v)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs + 2,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <ThemedText variant="footnote">{label}</ThemedText>
            <SFSymbol
              name={open ? "chevron.down" : "chevron.right"}
              size={11}
              tint={colors.tertiaryLabel}
            />
          </Pressable>
        </View>
      )}

      {expanded ? <ItemList items={row.previous} providerId={providerId} /> : null}
      {row.breakout.length > 0 ? <ItemList items={row.breakout} providerId={providerId} /> : null}
      <ItemList items={row.last} providerId={providerId} />
    </View>
  );
}
