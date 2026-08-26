import { and, asc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { backendSession, useSession } from "@/backend/backend-session";
import { ComposerBar } from "@/components/composer-bar";
import { AsciiLoader, latestThinking } from "@/components/ascii-loader";
import { PendingApprovalCard } from "@/components/pending-approval-card";
import { ThemedText } from "@/components/themed-text";
import { TranscriptTurn } from "@/components/transcript-turn";
import { db } from "@/db/client";
import { pendingApprovals, runArtifacts, runs, toolCalls, workspaces } from "@/db/schema";
import { isModeId, DEFAULT_MODE_ID } from "@mains/contracts/modes";
import { attachedSkills, composeGoal } from "@/lib/context-picker";
import type { PromptSkill } from "@/lib/prompt-chips";
import { buildTranscript } from "@/lib/transcript";
import { buildTurnRows, type TurnRow } from "@/lib/transcript-rows";
import { useModelSelection } from "@/lib/use-model-selection";
import { useNow } from "@/lib/use-now";
import { colors, radius, shadows, spacing } from "@/theme";

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runId = typeof id === "string" ? id : "";
  const session = useSession();
  const backendId = session.backend?.backendId ?? "";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const openRunOptions = (providerId: string) =>
    router.push({ pathname: "/model", params: { providerId } } as Href);

  // While this transcript is on screen its events trigger refetches.
  useFocusEffect(
    useCallback(() => {
      backendSession.openRun(runId);
      return () => backendSession.closeRun(runId);
    }, [runId]),
  );

  const runQuery = useLiveQuery(
    db.select().from(runs).where(and(eq(runs.backendId, backendId), eq(runs.id, runId))).limit(1),
    [backendId, runId],
  );
  const artifactQuery = useLiveQuery(
    db
      .select()
      .from(runArtifacts)
      .where(and(eq(runArtifacts.backendId, backendId), eq(runArtifacts.runId, runId)))
      .orderBy(asc(runArtifacts.createdAt), asc(runArtifacts.id)),
    [backendId, runId],
  );
  const callQuery = useLiveQuery(
    db
      .select()
      .from(toolCalls)
      .where(and(eq(toolCalls.backendId, backendId), eq(toolCalls.runId, runId)))
      .orderBy(asc(toolCalls.createdAt), asc(toolCalls.id)),
    [backendId, runId],
  );
  const approvalQuery = useLiveQuery(
    db
      .select()
      .from(pendingApprovals)
      .where(and(eq(pendingApprovals.backendId, backendId), eq(pendingApprovals.runId, runId)))
      .orderBy(asc(pendingApprovals.requestedAt)),
    [backendId, runId],
  );
  const now = useNow(1000, approvalQuery.data.length > 0);
  const waiting = useMemo(
    () => approvalQuery.data.filter((a) => a.expiresAt.getTime() > now),
    [approvalQuery.data, now],
  );

  const run = runQuery.data[0];
  // A run's workspace scopes what its provider lists behind `@` / `$`.
  const workspaceQuery = useLiveQuery(
    db
      .select({ rootPath: workspaces.rootPath })
      .from(workspaces)
      .where(and(eq(workspaces.backendId, backendId), eq(workspaces.id, run?.workspaceId ?? "")))
      .limit(1),
    [backendId, run?.workspaceId],
  );
  const modelSelection = useModelSelection(backendId, run?.providerId ?? "");
  const runIsLive = run?.status === "running" || run?.status === "queued";
  const connected = session.connection.kind === "connected";
  // Two passes, as on the desktop: the transcript's items, then the plan for
  // how a turn's items collapse into rows.
  const rows = useMemo(
    () => buildTurnRows(buildTranscript(artifactQuery.data, callQuery.data)),
    [artifactQuery.data, callQuery.data],
  );
  const thinking = useMemo(() => latestThinking(artifactQuery.data), [artifactQuery.data]);
  const mode = isModeId(run?.mode) ? run.mode : DEFAULT_MODE_ID;

  const [draft, setDraft] = useState("");
  const [contextSkills, setContextSkills] = useState<PromptSkill[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const send = async () => {
    const message = composeGoal(draft, contextSkills);
    if (!message || !run || runIsLive || !connected || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const result = await backendSession.continueRun(runId, message, attachedSkills(draft, contextSkills));
      if (!result.success) {
        setSendError(result.error);
        return;
      }
      setDraft("");
      setContextSkills([]);
    } catch (caught) {
      setSendError(caught instanceof Error ? caught.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  const listRef = useRef<FlatList<TurnRow>>(null);
  const composerHeight = 72 + insets.bottom;

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <Stack.Screen options={{ title: run?.title?.trim() || "Run" }} />

      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: composerHeight + spacing.md,
          gap: spacing.md,
        }}
        keyboardDismissMode="interactive"
        onContentSizeChange={() => {
          if (runIsLive) listRef.current?.scrollToEnd({ animated: true });
        }}
        ListEmptyComponent={
          <ThemedText variant="subhead" style={{ paddingVertical: spacing.xl, textAlign: "center" }}>
            {run ? "Nothing in this run yet." : "Loading run…"}
          </ThemedText>
        }
        ListFooterComponent={
          <View style={{ gap: spacing.md }}>
            {runIsLive ? <AsciiLoader mode={mode} thinkingText={thinking} /> : null}
            {waiting.map((approval) => (
              <PendingApprovalCard
                key={approval.requestId}
                approval={approval}
                now={now}
                onRespond={async ({ approved, answer }) => {
                  const result = await backendSession.respondToApproval(
                    approval.requestId,
                    approved,
                    answer,
                  );
                  if (!result.success) throw new Error(result.error);
                }}
              />
            ))}
            {run?.lastError ? (
              <View
                style={{
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  borderCurve: "continuous",
                  backgroundColor: colors.groupedCell,
                  boxShadow: shadows.card,
                  gap: spacing.xs,
                }}
              >
                <ThemedText variant="caption" style={{ color: colors.systemRed, fontWeight: "600" }}>
                  RUN FAILED
                </ThemedText>
                <ThemedText variant="subhead" selectable>
                  {run.lastError}
                </ThemedText>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <TranscriptTurn
            row={item}
            providerId={run?.providerId}
            // Only the final row can be the turn the agent is still inside.
            isRunInProgress={Boolean(runIsLive) && index === rows.length - 1}
          />
        )}
      />

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + spacing.sm,
        }}
      >
        <ComposerBar
          value={draft}
          onChangeText={setDraft}
          onSend={() => void send()}
          sending={sending}
          disabled={!connected || !!runIsLive || !run}
          error={sendError}
          placeholder={
            !connected
              ? "Connect to your Mac to continue this run"
              : runIsLive
                ? "The agent is still working…"
                : "Continue this run…"
          }
          model={
            run && modelSelection.label
              ? {
                  label: modelSelection.label,
                  effort: modelSelection.effortLabel,
                  onPress: () => openRunOptions(run.providerId),
                }
              : null
          }
          permission={
            run && modelSelection.permissionLabel
              ? { label: modelSelection.permissionLabel, onPress: () => openRunOptions(run.providerId) }
              : null
          }
          context={
            backendId && run
              ? {
                  backendId,
                  providerId: run.providerId,
                  workspacePath: workspaceQuery.data[0]?.rootPath ?? null,
                  skills: contextSkills,
                  onSkillsChange: setContextSkills,
                }
              : null
          }
        />
      </View>

      {process.env.EXPO_OS === "ios" && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="ellipsis">
            <Stack.Toolbar.MenuAction icon="arrow.clockwise" onPress={() => void backendSession.refresh()}>
              Sync now
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}
    </KeyboardAvoidingView>
  );
}
