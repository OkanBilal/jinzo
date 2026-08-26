import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import {
  detectTrigger,
  replaceTrigger,
  skillContext,
  skillMention,
  type ContextBucket,
  type ContextTrigger,
  type PickerRow,
} from "@/lib/context-picker";
import type { PromptSkill } from "@/lib/prompt-chips";
import { colors, radius, spacing, type, useBrandColors } from "@/theme";

import { ContextPicker } from "./context-picker";
import { GlassSurface } from "./glass-surface";
import { SFSymbol } from "./sf-symbol";
import { ThemedText } from "./themed-text";

/**
 * What the composer needs to offer its context menu. Omitted on a screen with
 * no backend to ask — the "+" button then stays inert, as before.
 */
export interface ComposerContext {
  backendId: string;
  providerId: string;
  /** The run target's folder on the Mac, when there is one. */
  workspacePath?: string | null;
  /** Skills attached to the next send; the caller passes them to the Mac. */
  skills: PromptSkill[];
  onSkillsChange: (skills: PromptSkill[]) => void;
}

/**
 * The floating glass composer, in two rows like the Claude app's: the text on
 * top; below it the attach button, the model pill (model + effort) and the
 * send button. Used to start a run on home and to continue one on the run
 * screen.
 */
export function ComposerBar({
  value,
  onChangeText,
  onSend,
  placeholder,
  disabled = false,
  sending = false,
  error,
  onAdd,
  model,
  permission,
  context,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled?: boolean;
  sending?: boolean;
  error?: string | null;
  /** The "+" button; without a handler it is shown but inert. */
  onAdd?: () => void;
  /** The model pill: what is selected, its effort, and what tapping opens. */
  model?: { label: string; effort?: string | null; onPress: () => void } | null;
  /** The permission-mode pill — worth seeing before sending from a phone. */
  permission?: { label: string; onPress: () => void } | null;
  /** Skills and commands behind `@` / `/` / `$` and the "+" button. */
  context?: ComposerContext | null;
}) {
  const brand = useBrandColors();
  const canSend = !disabled && !sending && value.trim().length > 0;

  // The "+" button opens the plugins bucket with no token in the text, the way
  // the desktop's toolbar picker does; typing a trigger opens the full menu.
  const [pickerBucket, setPickerBucket] = useState<ContextBucket | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const typed = context ? detectTrigger(value) : null;
  const trigger: ContextTrigger = pickerBucket ? "$" : (typed?.trigger ?? "@");
  const menuVisible = Boolean(context) && (pickerOpen || typed !== null);

  const closeMenu = () => {
    setPickerOpen(false);
    setPickerBucket(null);
    // A typed trigger keeps the menu open on its own, so dismissing means
    // dropping the token — otherwise the sheet reopens on the next render.
    if (typed) onChangeText(replaceTrigger(value, typed, ""));
  };

  const pick = (row: PickerRow) => {
    if (!context) return;
    if (row.kind === "skill") {
      const picked = skillContext(row.skill);
      // The label lands where the trigger was, so the sentence still reads as
      // it was meant; `composeGoal` swaps it back to `$name` on the way out.
      const mention = skillMention(picked);
      onChangeText(
        typed
          ? replaceTrigger(value, typed, mention)
          : `${value}${value && !/\s$/.test(value) ? " " : ""}${mention} `,
      );
      if (!context.skills.some((s) => s.name === picked.name)) {
        context.onSkillsChange([...context.skills, picked]);
      }
    } else {
      // A command is not an attachment; it *is* the message, so it stays put.
      const replacement = `/${row.command.name}`;
      onChangeText(
        typed
          ? replaceTrigger(value, typed, replacement)
          : `${value}${value && !/\s$/.test(value) ? " " : ""}${replacement} `,
      );
    }
    setPickerOpen(false);
    setPickerBucket(null);
  };

  return (
    <View style={{ paddingHorizontal: spacing.ms, gap: spacing.xs }}>
      {error ? (
        <ThemedText variant="footnote" style={{ color: colors.systemRed, paddingHorizontal: spacing.sm }}>
          {error}
        </ThemedText>
      ) : null}
      <GlassSurface
        style={{
          borderRadius: radius.xl + 8,
          borderCurve: "continuous",
          paddingHorizontal: spacing.ms,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <TextInput
          accessibilityLabel="Message"
          editable={!disabled && !sending}
          multiline
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.tertiaryLabel as string}
          style={[
            type.body,
            {
              minHeight: 28,
              maxHeight: 132,
              paddingHorizontal: spacing.xs,
              paddingTop: spacing.xs,
              paddingBottom: 0,
              color: colors.label,
            },
          ]}
          value={value}
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <RoundControl
            label={context ? "Plugins and skills" : "Add"}
            onPress={
              context
                ? () => {
                    setPickerBucket("plugins");
                    setPickerOpen(true);
                  }
                : onAdd
            }
            disabled={!context && !onAdd}
          >
            <SFSymbol name="plus" size={18} tint={colors.label} />
          </RoundControl>

          {model ? (
            <Pill
              label={`Model: ${model.label}${model.effort ? `, effort ${model.effort}` : ""}`}
              onPress={model.onPress}
            >
              <ThemedText variant="subhead" numberOfLines={1} style={{ fontWeight: "600", flexShrink: 1 }}>
                {model.label}
              </ThemedText>
              {model.effort ? (
                <ThemedText variant="subhead" numberOfLines={1} style={{ color: colors.secondaryLabel }}>
                  {model.effort}
                </ThemedText>
              ) : null}
            </Pill>
          ) : null}

          {permission ? (
            <Pill label={`Permissions: ${permission.label}`} onPress={permission.onPress}>
              <ThemedText variant="subhead" numberOfLines={1} style={{ fontWeight: "600" }}>
                {permission.label}
              </ThemedText>
            </Pill>
          ) : null}

          <View style={{ flex: 1 }} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!canSend}
            onPress={onSend}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: canSend ? brand.accent : colors.fill,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <SFSymbol
              name={sending ? "ellipsis" : "arrow.up"}
              size={16}
              tint={canSend ? brand.accentContrast : colors.tertiaryLabel}
            />
          </Pressable>
        </View>
      </GlassSurface>

      {context ? (
        <ContextPicker
          visible={menuVisible}
          backendId={context.backendId}
          providerId={context.providerId}
          workspacePath={context.workspacePath}
          trigger={trigger}
          bucket={pickerBucket}
          filter={pickerBucket ? "" : (typed?.filter ?? "")}
          onSelect={pick}
          onClose={closeMenu}
        />
      ) : null}
    </View>
  );
}

function Pill({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs + 2,
        height: 36,
        paddingHorizontal: spacing.ms,
        borderRadius: radius.full,
        backgroundColor: colors.fill,
        opacity: pressed ? 0.7 : 1,
        flexShrink: 1,
      })}
    >
      {children}
    </Pressable>
  );
}

function RoundControl({
  label,
  onPress,
  disabled = false,
  children,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.fill,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
