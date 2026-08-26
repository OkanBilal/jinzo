import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";

import { backendSession, useSession } from "@/backend/backend-session";
import { setModelChoice } from "@/backend/sync";
import { SFSymbol } from "@/components/sf-symbol";
import { ThemedText } from "@/components/themed-text";
import type { UpdateRunSettingsPayload } from "@mains/contracts/runs";
import {
  effortOffAllowed,
  formatEffortLevel,
  modelPrettyName,
  parseEffortLevels,
  pickDefaultEffort,
} from "@/lib/models";
import { useModelSelection } from "@/lib/use-model-selection";
import { colors, radius, shadows, spacing, useBrandColors } from "@/theme";

/**
 * The run options sheet, in the shape of the Claude app's model sheet: the
 * provider's models with a line each and the one in effect checked; below
 * them the rows the desktop's composer toolbar has — Effort and Permissions
 * unfold into their choices, fast / goal / plan are switches, each shown
 * only where the provider and model support it. The model is this phone's
 * choice (it rides on the next run); everything else is the Mac's provider
 * setting, shared with the desktop.
 */
export default function RunOptionsSheet() {
  const router = useRouter();
  const { providerId: param } = useLocalSearchParams<{ providerId: string }>();
  const providerId = typeof param === "string" ? param : "";
  const session = useSession();
  const backendId = session.backend?.backendId ?? "";
  const selection = useModelSelection(backendId, providerId);

  const [open, setOpen] = useState<"effort" | "permission" | null>(null);
  const [pending, setPending] = useState<UpdateRunSettingsPayload>({});
  const [hint, setHint] = useState<string | null>(null);

  const apply = async (patch: UpdateRunSettingsPayload) => {
    setPending((current) => ({ ...current, ...patch }));
    setHint(null);
    const result = await backendSession.updateRunSettings(providerId, patch);
    setPending((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof UpdateRunSettingsPayload)[]) delete next[key];
      return next;
    });
    if (!result.success) setHint(result.error);
  };

  const chooseModel = (model: (typeof selection.models)[number]) => {
    setModelChoice(backendId, providerId, model.id);
    // Keep the effort within what the new model offers, as the desktop does.
    const levels = parseEffortLevels(model.effortLevels);
    const current = selection.effortLevel;
    if (levels.length > 0 && current && current !== "ultracode" && !levels.includes(current)) {
      void apply({ effortLevel: pickDefaultEffort(levels, current) });
    }
  };

  const effortOptions = [...(effortOffAllowed(providerId) ? [""] : []), ...selection.supportedLevels];
  const shownEffort = pending.effortLevel ?? selection.effortLevel;
  const shownPermission = pending.permissionMode ?? selection.permissionMode;
  const permissionOption = selection.permissionOptions.find((m) => m.value === shownPermission);
  const toggle = (key: "fastMode" | "goalMode" | "planMode", value: boolean) => {
    if (pending[key] !== undefined) return;
    void apply({ [key]: value });
  };
  const toggleValue = (key: "fastMode" | "goalMode" | "planMode") => pending[key] ?? selection[key];

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.ms, gap: spacing.md, paddingBottom: spacing.xxl }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.fill,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <SFSymbol name="xmark" size={17} tint={colors.label} />
        </Pressable>
        <ThemedText variant="headline">Run options</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <Card>
        {selection.models.length === 0 ? (
          <ThemedText variant="subhead" style={{ padding: spacing.md }}>
            {session.connection.kind === "connected"
              ? "No models reported by this provider yet."
              : "Connect to your Mac to load its models."}
          </ThemedText>
        ) : (
          selection.models.map((model, index) => (
            <Row
              key={model.id}
              first={index === 0}
              title={modelPrettyName(model, providerId)}
              subtitle={model.description ?? undefined}
              selected={selection.selected?.id === model.id}
              onPress={() => chooseModel(model)}
            />
          ))
        )}
      </Card>

      <Card>
        <Row
          first
          title="Effort"
          value={selection.supportedLevels.length > 0 || shownEffort ? formatEffortLevel(shownEffort) : "—"}
          chevron={open === "effort" ? "chevron.down" : "chevron.right"}
          disabled={effortOptions.length === 0}
          onPress={() => setOpen((current) => (current === "effort" ? null : "effort"))}
        />
        {open === "effort" &&
          effortOptions.map((level) => (
            <Row
              key={level || "off"}
              first={false}
              indented
              title={formatEffortLevel(level)}
              selected={shownEffort === level}
              onPress={() => {
                if (level !== shownEffort) void apply({ effortLevel: level });
              }}
            />
          ))}
      </Card>

      {selection.permissionOptions.length > 0 && (
        <Card>
          <Row
            first
            title="Permissions"
            value={permissionOption?.label ?? shownPermission}
            chevron={open === "permission" ? "chevron.down" : "chevron.right"}
            onPress={() => setOpen((current) => (current === "permission" ? null : "permission"))}
          />
          {open === "permission" &&
            selection.permissionOptions.map((option) => (
              <Row
                key={option.value}
                first={false}
                indented
                title={option.label}
                subtitle={option.description}
                selected={shownPermission === option.value}
                onPress={() => {
                  if (option.value !== shownPermission) void apply({ permissionMode: option.value });
                }}
              />
            ))}
        </Card>
      )}

      {(selection.supportsFastMode || selection.supportsGoalMode || selection.supportsPlanMode) && (
        <Card>
          {selection.supportsFastMode && (
            <Row
              first
              title="Fast mode"
              trailing={<Toggle value={toggleValue("fastMode")} onChange={(v) => toggle("fastMode", v)} />}
            />
          )}
          {selection.supportsGoalMode && (
            <Row
              first={!selection.supportsFastMode}
              title="Goal mode"
              subtitle="Track this prompt as the thread's goal"
              trailing={<Toggle value={toggleValue("goalMode")} onChange={(v) => toggle("goalMode", v)} />}
            />
          )}
          {selection.supportsPlanMode && (
            <Row
              first={!selection.supportsFastMode && !selection.supportsGoalMode}
              title="Plan mode"
              subtitle="Plan before executing"
              trailing={<Toggle value={toggleValue("planMode")} onChange={(v) => toggle("planMode", v)} />}
            />
          )}
        </Card>
      )}

      {hint ? (
        <ThemedText variant="footnote" selectable style={{ textAlign: "center", color: colors.systemOrange }}>
          {hint}
        </ThemedText>
      ) : null}
    </ScrollView>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const brand = useBrandColors();
  return <Switch value={value} onValueChange={onChange} trackColor={{ true: brand.accent }} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.groupedCell,
        boxShadow: shadows.card,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

function Row({
  title,
  subtitle,
  value,
  chevron,
  trailing,
  selected = false,
  indented = false,
  disabled = false,
  first,
  onPress,
}: {
  title: string;
  subtitle?: string;
  /** Trailing text (a row's current choice). */
  value?: string;
  /** Trailing SF Symbol (a row's disclosure). */
  chevron?: string;
  /** Trailing control (a switch); the row itself is then not pressable. */
  trailing?: React.ReactNode;
  selected?: boolean;
  indented?: boolean;
  disabled?: boolean;
  first: boolean;
  onPress?: () => void;
}) {
  const brand = useBrandColors();
  return (
    <View>
      {!first && <View style={{ height: 1, marginLeft: spacing.md, backgroundColor: colors.separator }} />}
      <Pressable
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityState={{ selected, disabled }}
        disabled={disabled || !onPress}
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.ms,
          paddingLeft: indented ? spacing.lg : spacing.md,
          paddingRight: spacing.md,
          paddingVertical: subtitle ? spacing.sm + 2 : spacing.ms + 2,
          backgroundColor: pressed && onPress ? colors.fill : "transparent",
          opacity: disabled ? 0.5 : 1,
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="body" numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText variant="footnote" numberOfLines={2} style={{ color: colors.secondaryLabel }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {value ? (
          <ThemedText variant="body" numberOfLines={1} style={{ color: colors.secondaryLabel, maxWidth: "45%" }}>
            {value}
          </ThemedText>
        ) : null}
        {chevron ? <SFSymbol name={chevron} size={13} tint={colors.tertiaryLabel} /> : null}
        {selected && <SFSymbol name="checkmark" size={16} tint={brand.accent} />}
        {trailing}
      </Pressable>
    </View>
  );
}
