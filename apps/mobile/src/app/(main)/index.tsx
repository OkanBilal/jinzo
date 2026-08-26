import { and, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useNavigation, useRouter, type Href } from "expo-router";
import { DrawerActions } from "expo-router/react-navigation";
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { backendSession, useSession } from "@/backend/backend-session";
import { Button } from "@/components/button";
import { ComposerBar } from "@/components/composer-bar";
import { attachedSkills, composeGoal } from "@/lib/context-picker";
import type { PromptSkill } from "@/lib/prompt-chips";
import { ModeMenu } from "@/components/mode-menu";
import { ProjectIcon } from "@/components/project-icon";
import { RoundGlassButton } from "@/components/round-glass-button";
import { SFSymbol } from "@/components/sf-symbol";
import { SidebarIcon } from "@/components/sidebar-icon";
import { ConnectionBadge } from "@/components/status";
import { ThemedText } from "@/components/themed-text";
import { providerModes, type ModeId } from "@mains/contracts/runs";
import { useModelSelection } from "@/lib/use-model-selection";
import { db } from "@/db/client";
import { collections, pendingApprovals, providers, spaceTargets, spaces, workspaces } from "@/db/schema";
import { colors, radius, shadows, spacing, useBrandColors } from "@/theme";

/**
 * Home, in the shape of a chat app's "new conversation": the mode segment on
 * top, an empty canvas, the run target above the composer, the composer at
 * the bottom. The target model is the desktop's: the space chosen in the
 * sidebar pins provider + mode; Code runs need a workspace, Work/Chat may
 * take a project.
 */
export default function NewRunScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const backendId = session.backend?.backendId ?? "";
  const spaceId = session.selectedSpaceId ?? "";
  const connected = session.connection.kind === "connected";

  const pendingList = useLiveQuery(
    db
      .select({ requestId: pendingApprovals.requestId })
      .from(pendingApprovals)
      .where(eq(pendingApprovals.backendId, backendId)),
    [backendId],
  );
  const spaceQuery = useLiveQuery(
    db.select().from(spaces).where(and(eq(spaces.backendId, backendId), eq(spaces.id, spaceId))).limit(1),
    [backendId, spaceId],
  );
  const targetQuery = useLiveQuery(
    db
      .select()
      .from(spaceTargets)
      .where(and(eq(spaceTargets.backendId, backendId), eq(spaceTargets.spaceId, spaceId)))
      .limit(1),
    [backendId, spaceId],
  );
  const workspaceQuery = useLiveQuery(
    db.select().from(workspaces).where(eq(workspaces.backendId, backendId)),
    [backendId],
  );
  const collectionQuery = useLiveQuery(
    db.select().from(collections).where(eq(collections.backendId, backendId)),
    [backendId],
  );
  const providerQuery = useLiveQuery(
    db.select().from(providers).where(eq(providers.backendId, backendId)),
    [backendId],
  );

  const space = spaceQuery.data[0];
  const target = targetQuery.data[0];
  const isCode = space?.mode === "developer";
  const workspace = workspaceQuery.data.find((w) => w.id === target?.workspaceId);
  const collection = collectionQuery.data.find((c) => c.id === target?.collectionId);
  const providerEnabled = space
    ? providerQuery.data.some((p) => p.id === space.providerId && p.isEnabled)
    : true;
  const modes = space ? providerModes(space.providerId) : [];
  const modelSelection = useModelSelection(backendId, space?.providerId ?? "");

  const [draft, setDraft] = useState("");
  const [contextSkills, setContextSkills] = useState<PromptSkill[]>([]);
  const [sending, setSending] = useState(false);
  const [pendingMode, setPendingMode] = useState<ModeId | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const openRunOptions = (providerId: string) =>
    router.push({ pathname: "/model", params: { providerId } } as Href);

  const openSidebar = () => {
    // The drawer only dismisses the keyboard for the swipe gesture; the
    // button path has to do it, or the composer stays focused under the panel.
    Keyboard.dismiss();
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const changeMode = async (mode: ModeId) => {
    if (!space || mode === space.mode) return;
    setPendingMode(mode);
    setHint(null);
    const result = await backendSession.setSpaceMode(space.id, mode);
    setPendingMode(null);
    if (!result.success) setHint(result.error);
  };

  const send = async () => {
    // What was typed plus a token per attached skill — the chips never put one
    // in the input, but the transcript needs it to draw them back.
    const goal = composeGoal(draft, contextSkills);
    if (!goal || !space || !connected || sending) return;
    if (isCode && !workspace) {
      setHint("Pick a workspace for this Code run first.");
      return;
    }
    setSending(true);
    setHint(null);
    try {
      const result = await backendSession.startRun({
        goal,
        workspaceId: workspace?.id ?? null,
        collectionId: collection?.id ?? null,
        contextSkills: attachedSkills(draft, contextSkills),
      });
      if (!result.success) {
        setHint(result.error);
        return;
      }
      setDraft("");
      setContextSkills([]);
      router.push(`/run/${result.data.runId}` as Href);
    } catch (caught) {
      setHint(caught instanceof Error ? caught.message : "Could not start the run");
    } finally {
      setSending(false);
    }
  };

  const targetLabel = isCode
    ? (workspace?.name ?? "Choose a workspace")
    : (collection?.name ?? "No project");

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.systemBackground }}
    >
      {/* Floating controls instead of a navigation bar */}
      <View
        style={{
          position: "absolute",
          top: insets.top + spacing.sm,
          left: spacing.md,
          right: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 1,
        }}
      >
        <RoundGlassButton
          icon={<SidebarIcon size={22} color={colors.label} />}
          label="Open sidebar"
          onPress={openSidebar}
        />
        {space ? (
          <ModeMenu
            modes={modes}
            value={pendingMode ?? (space.mode as ModeId)}
            pending={pendingMode !== null}
            onChange={(mode) => void changeMode(mode)}
          />
        ) : (
          <View />
        )}
        <RoundGlassButton
          icon={pendingList.data.length > 0 ? "bell.badge" : "tray"}
          label="Activity"
          badge={pendingList.data.length > 0 ? pendingList.data.length : undefined}
          onPress={() => router.push("/inbox" as Href)}
        />
      </View>

      {/* The canvas stays empty on purpose. */}
      <View style={{ flex: 1 }} />

      <View style={{ paddingBottom: insets.bottom + spacing.sm, gap: spacing.ms }}>
        {!session.backend && session.loaded && (
          <View
            style={{
              marginHorizontal: spacing.ms,
              padding: spacing.md,
              borderRadius: radius.lg,
              borderCurve: "continuous",
              backgroundColor: colors.groupedCell,
              boxShadow: shadows.card,
              gap: spacing.sm,
            }}
          >
            <ThemedText variant="headline">No Mac paired</ThemedText>
            <ThemedText variant="subhead">
              Open Mains on the desktop, turn on network access or Tailscale HTTPS, and scan its pairing code.
            </ThemedText>
            <Button title="Scan pairing code" onPress={() => router.push("/pair" as Href)} />
          </View>
        )}

        {session.backend && !connected && (
          <View
            style={{
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.ms,
              paddingVertical: spacing.xs + 2,
              borderRadius: radius.full,
              backgroundColor: colors.fill,
            }}
          >
            <ThemedText variant="footnote">{session.backend.name}</ThemedText>
            <ConnectionBadge state={session.connection} />
          </View>
        )}

        {/* Run target */}
        {space && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
            }}
          >
            <TargetChip
              icon={isCode ? "folder" : collection ? null : "tray"}
              projectIcon={collection?.icon ?? null}
              label={targetLabel}
              emphasized={isCode && !workspace}
              onPress={() => router.push("/target" as Href)}
            />
          </View>
        )}

        {hint ? (
          <ThemedText
            variant="footnote"
            selectable
            style={{ textAlign: "center", paddingHorizontal: spacing.lg, color: colors.systemOrange }}
          >
            {hint}
          </ThemedText>
        ) : null}

        <ComposerBar
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            if (hint) setHint(null);
          }}
          onSend={() => void send()}
          sending={sending}
          placeholder={space ? `Start a run in ${space.name}` : "Start a run"}
          disabled={!session.backend || !connected || !space || !providerEnabled}
          model={
            space && modelSelection.label
              ? {
                  label: modelSelection.label,
                  effort: modelSelection.effortLabel,
                  onPress: () => openRunOptions(space.providerId),
                }
              : null
          }
          permission={
            space && modelSelection.permissionLabel
              ? { label: modelSelection.permissionLabel, onPress: () => openRunOptions(space.providerId) }
              : null
          }
          context={
            backendId && space
              ? {
                  backendId,
                  providerId: space.providerId,
                  workspacePath: workspace?.rootPath ?? null,
                  skills: contextSkills,
                  onSkillsChange: setContextSkills,
                }
              : null
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function TargetChip({
  icon,
  projectIcon,
  label,
  emphasized = false,
  onPress,
}: {
  /** An SF Symbol, or `null` to show the chosen project's own icon instead. */
  icon: string | null;
  projectIcon: string | null;
  label: string;
  emphasized?: boolean;
  onPress: () => void;
}) {
  const brand = useBrandColors();
  const tint = emphasized ? brand.accent : colors.secondaryLabel;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs + 2,
        paddingLeft: spacing.ms,
        paddingRight: spacing.sm,
        height: 34,
        borderRadius: radius.full,
        backgroundColor: emphasized ? brand.accentSoft : colors.fill,
        opacity: pressed ? 0.7 : 1,
        maxWidth: "70%",
      })}
    >
      {icon ? (
        <SFSymbol name={icon} size={14} tint={tint} />
      ) : (
        <ProjectIcon icon={projectIcon} size={14} color={tint} />
      )}
      <ThemedText
        variant="footnote"
        numberOfLines={1}
        style={{ color: emphasized ? brand.accent : colors.label, fontWeight: "600" }}
      >
        {label}
      </ThemedText>
      <SFSymbol name="chevron.down" size={11} tint={emphasized ? brand.accent : colors.tertiaryLabel} />
    </Pressable>
  );
}
