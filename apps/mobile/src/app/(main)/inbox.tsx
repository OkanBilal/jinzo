import { desc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { backendSession, useSession, type SessionSnapshot } from "@/backend/backend-session";
import { Button } from "@/components/button";
import { PendingApprovalCard } from "@/components/pending-approval-card";
import { RunRow } from "@/components/run-row";
import { ConnectionBadge } from "@/components/status";
import { ThemedText } from "@/components/themed-text";
import { db } from "@/db/client";
import { pendingApprovals, runs, workspaces } from "@/db/schema";
import { connectionDetail } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { colors, radius, shadows, spacing } from "@/theme";

/** What needs you, what is running, what just finished. */
export default function ActivityScreen() {
  const router = useRouter();
  const session = useSession();
  const backendId = session.backend?.backendId ?? "";

  const runList = useLiveQuery(
    db
      .select()
      .from(runs)
      .where(eq(runs.backendId, backendId))
      .orderBy(desc(runs.updatedAt))
      .limit(60),
    [backendId],
  );
  const workspaceList = useLiveQuery(
    db.select().from(workspaces).where(eq(workspaces.backendId, backendId)),
    [backendId],
  );
  const approvalList = useLiveQuery(
    db.select().from(pendingApprovals).where(eq(pendingApprovals.backendId, backendId)),
    [backendId],
  );
  const workspaceNames = useMemo(
    () => new Map(workspaceList.data.map((w) => [w.id, w.name])),
    [workspaceList.data],
  );
  const runTitles = useMemo(
    () => new Map(runList.data.map((r) => [r.id, r.title])),
    [runList.data],
  );
  const now = useNow(1000, approvalList.data.length > 0);
  const waiting = useMemo(
    () =>
      [...approvalList.data]
        .filter((a) => a.expiresAt.getTime() > now)
        .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime()),
    [approvalList.data, now],
  );
  const active = runList.data.filter((r) => r.status === "running" || r.status === "queued");
  const recent = runList.data.filter((r) => r.status !== "running" && r.status !== "queued").slice(0, 15);

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await backendSession.refresh();
    } catch {
      // the connection card already shows why
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {!session.backend ? (
        <View style={{ gap: spacing.ms }}>
          <ThemedText variant="subhead">Pair a Mac to see its runs here.</ThemedText>
          <Button title="Scan pairing code" onPress={() => router.push("/pair" as Href)} />
        </View>
      ) : (
        <>
          {session.connection.kind !== "connected" && <ConnectionCard session={session} />}

          {waiting.length > 0 && (
            <Section title="Needs you" count={waiting.length}>
              <View style={{ gap: spacing.sm }}>
                {waiting.map((approval) => (
                  <PendingApprovalCard
                    key={approval.requestId}
                    approval={approval}
                    now={now}
                    runTitle={runTitles.get(approval.runId) ?? null}
                    compact
                    onPress={() => router.push(`/run/${approval.runId}` as Href)}
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
              </View>
            </Section>
          )}

          {active.length > 0 && (
            <Section title="Active">
              <GroupedList>
                {active.map((run) => (
                  <RunRow key={run.id} run={run} workspaceName={workspaceNames.get(run.workspaceId ?? "")} />
                ))}
              </GroupedList>
            </Section>
          )}

          <Section title="Recent">
            {recent.length > 0 ? (
              <GroupedList>
                {recent.map((run) => (
                  <RunRow key={run.id} run={run} workspaceName={workspaceNames.get(run.workspaceId ?? "")} />
                ))}
              </GroupedList>
            ) : (
              <ThemedText variant="subhead">
                {session.connection.kind === "connected"
                  ? "No runs on this Mac yet."
                  : "Runs appear once the Mac is reachable."}
              </ThemedText>
            )}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm, paddingHorizontal: spacing.xs }}>
        <ThemedText variant="title3">{title}</ThemedText>
        {count !== undefined && (
          <ThemedText variant="subhead" style={{ fontVariant: ["tabular-nums"] }}>
            {count}
          </ThemedText>
        )}
      </View>
      {children}
    </View>
  );
}

/** Rows inside one rounded, inset-grouped container with hairline separators. */
function GroupedList({ children }: { children: ReactNode[] }) {
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
      {children.map((child, index) => (
        <View key={index}>
          {index > 0 && (
            <View
              style={{
                height: 1,
                marginLeft: spacing.md + spacing.ms + 7,
                backgroundColor: colors.separator,
              }}
            />
          )}
          {child}
        </View>
      ))}
    </View>
  );
}

function ConnectionCard({ session }: { session: SessionSnapshot }) {
  const { backend, connection } = session;
  if (!backend) return null;
  const detail = connectionDetail(connection);
  const canRetry = connection.kind === "unreachable" || connection.kind === "offline";
  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: colors.groupedCell,
        boxShadow: shadows.card,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <ThemedText variant="headline" numberOfLines={1} style={{ flex: 1 }}>
          {backend.name}
        </ThemedText>
        <ConnectionBadge state={connection} />
      </View>
      {detail ? <ThemedText variant="subhead">{detail}</ThemedText> : null}
      {(canRetry || connection.kind === "authBlocked") && (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {canRetry && (
            <Button title="Retry" variant="secondary" size="sm" onPress={() => void backendSession.refresh()} />
          )}
          {connection.kind === "authBlocked" && (
            <Button title="Pair again" size="sm" onPress={() => void backendSession.forget()} />
          )}
        </View>
      )}
    </View>
  );
}
