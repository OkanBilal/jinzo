import { Image } from "expo-image";
import { Pressable, ScrollView, View } from "react-native";

import type { ComposerAttachment } from "@/lib/composer-attachments";
import { colors, radius, spacing } from "@/theme";

import { SFSymbol } from "./sf-symbol";
import { ThemedText } from "./themed-text";

export function ComposerAttachmentStrip({
  attachments,
  onRemove,
}: {
  attachments: ComposerAttachment[];
  onRemove: (id: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm }}
    >
      {attachments.map((attachment) => (
        <View
          key={attachment.id}
          style={{
            maxWidth: 176,
            height: 36,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingLeft: spacing.xs,
            paddingRight: spacing.xs,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.fill,
          }}
        >
          {attachment.type === "image" ? (
            <Image
              source={{ uri: attachment.uri }}
              contentFit="cover"
              style={{ width: 28, height: 28, borderRadius: radius.sm }}
            />
          ) : (
            <View
              style={{
                width: 28,
                height: 28,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius.sm,
                borderCurve: "continuous",
                backgroundColor: colors.fill,
              }}
            >
              <SFSymbol name="doc" size={15} tint={colors.secondaryLabel} />
            </View>
          )}
          <ThemedText variant="caption" numberOfLines={1} style={{ flexShrink: 1, color: colors.label }}>
            {attachment.name}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${attachment.name}`}
            hitSlop={8}
            onPress={() => onRemove(attachment.id)}
            style={({ pressed }) => ({ padding: spacing.xxs, opacity: pressed ? 0.6 : 1 })}
          >
            <SFSymbol name="xmark" size={10} tint={colors.secondaryLabel} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
