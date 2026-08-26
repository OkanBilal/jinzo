import { useColorScheme, View } from "react-native";

import { iconTint, parseIcon } from "@/lib/icon-registry";
import { colors, useBrandColors } from "@/theme";

import { GlassSurface } from "./glass-surface";
import { RegistryIcon } from "./registry-icon";
import { ThemedText } from "./themed-text";

/** The ring around the selected space. */
const RING = 2;

/**
 * A space as a round glass disc, drawn with the same icon the desktop shows
 * for it: a registry icon (in its picked tint, if any), an emoji, or — with
 * no icon set — the space's initial. The selected one gets the brand ring and
 * a brand wash over its glass.
 */
export function SpaceGlyph({
  space,
  size = 40,
  selected = false,
}: {
  space: { name: string; icon: string | null };
  size?: number;
  selected?: boolean;
}) {
  const brand = useBrandColors();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const icon = parseIcon(space.icon);
  const neutral = selected ? brand.accent : colors.label;
  // A user-picked tint wins over the selection color, as on the desktop.
  const tint = icon?.type === "icon" ? (iconTint(icon.color, scheme) ?? neutral) : neutral;
  const inner = size - RING * 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: RING,
        borderColor: selected ? brand.accent : "transparent",
      }}
    >
      <GlassSurface
        interactive
        tintColor={selected ? brand.accentSoft : undefined}
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon?.type === "icon" ? (
          <RegistryIcon shape={icon.shape} size={size * 0.5} color={tint} />
        ) : icon?.type === "emoji" ? (
          <ThemedText variant="callout">{icon.value}</ThemedText>
        ) : (
          <ThemedText variant="headline" style={{ color: neutral }}>
            {(space.name.trim()[0] ?? "?").toUpperCase()}
          </ThemedText>
        )}
      </GlassSurface>
    </View>
  );
}
