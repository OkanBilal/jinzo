import { Host, List, ListItem, Text as NativeText } from "@expo/ui";
import Constants from "expo-constants";
import { useRouter, type Href } from "expo-router";
import { Alert, ScrollView, View } from "react-native";

import { backendSession, useSession } from "@/backend/backend-session";
import { Button } from "@/components/button";
import { ThemedText } from "@/components/themed-text";
import { endpointHost } from "@mains/contracts/backend";
import { WS_PROTOCOL_VERSION } from "@mains/contracts/ws-protocol";
import { connectionDetail, connectionLabel } from "@/lib/format";
import { spacing } from "@/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const session = useSession();
  const { backend, connection } = session;

  const forget = () => {
    Alert.alert(
      "Forget this Mac?",
      "The pairing and everything cached from it will be removed from this phone. Revoke it on the Mac too if the phone is lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Forget",
          style: "destructive",
          onPress: () => {
            void backendSession.forget().then(() => router.dismissTo("/" as Href));
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="title3" style={{ paddingHorizontal: spacing.xs }}>
          This Mac
        </ThemedText>
        {backend ? (
          <>
            <Host matchContents>
              <List>
                <ListItem supportingText={connectionDetail(connection) ?? undefined}>
                  <NativeText>{backend.name}</NativeText>
                </ListItem>
                <ListItem supportingText={connectionLabel(connection)}>
                  <NativeText>Status</NativeText>
                </ListItem>
                {backend.endpoints.map((endpoint, index) => (
                  <ListItem key={endpoint} supportingText={endpointHost(endpoint)}>
                    <NativeText>{index === 0 ? "Address" : "Fallback address"}</NativeText>
                  </ListItem>
                ))}
                <ListItem supportingText={new Date(backend.pairedAt).toLocaleString()}>
                  <NativeText>Paired</NativeText>
                </ListItem>
              </List>
            </Host>
            <View style={{ flexDirection: "row", gap: spacing.sm, paddingTop: spacing.xs }}>
              <Button
                title="Sync now"
                variant="secondary"
                size="sm"
                onPress={() => void backendSession.refresh()}
              />
              {connection.kind === "authBlocked" && (
                <Button title="Pair again" size="sm" onPress={() => router.push("/pair" as Href)} />
              )}
              <Button title="Forget this Mac" variant="destructive" size="sm" onPress={forget} />
            </View>
          </>
        ) : (
          <View style={{ gap: spacing.ms }}>
            <ThemedText variant="subhead">No Mac is paired with this phone.</ThemedText>
            <Button title="Scan pairing code" onPress={() => router.push("/pair" as Href)} />
          </View>
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="title3" style={{ paddingHorizontal: spacing.xs }}>
          App
        </ThemedText>
        <Host matchContents>
          <List>
            <ListItem supportingText={Constants.expoConfig?.version ?? "0.0.0"}>
              <NativeText>Version</NativeText>
            </ListItem>
            <ListItem supportingText={String(WS_PROTOCOL_VERSION)}>
              <NativeText>Protocol</NativeText>
            </ListItem>
            <ListItem supportingText={String(Constants.expoConfig?.extra?.appVariant ?? "production")}>
              <NativeText>Build</NativeText>
            </ListItem>
          </List>
        </Host>
      </View>
    </ScrollView>
  );
}
