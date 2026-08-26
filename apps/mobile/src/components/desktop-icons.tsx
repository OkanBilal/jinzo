import type { ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

/**
 * Three glyphs carried over from the desktop, path for path.
 *
 * Everywhere else the phone reaches for an SF Symbol, which keeps it native and
 * costs nothing. These three are the exception because they sit on an agent's
 * *answer*, next to the desktop's own — the same affordance in two places
 * should not be two different marks. `arrow.triangle.branch` in particular is
 * not the desktop's fork at all; its Fork is git's branch glyph.
 *
 * Copied from `components/ui/icons/{fork,clipboard,check}.tsx`, all on the same
 * 24-unit grid and stroked rather than filled — which is why they don't belong
 * in `@mains/icons`, whose shapes are fill-only paths for the icon registry.
 */

interface GlyphProps {
  size?: number;
  color: ColorValue;
}

/** Git's branch mark — the desktop's `Fork`. */
export function ForkIcon({ size = 16, color }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3v12"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={18} cy={6} r={3} stroke={color} strokeWidth={1.5} />
      <Circle cx={6} cy={18} r={3} stroke={color} strokeWidth={1.5} />
      <Path
        d="M18 9a9 9 0 0 1-9 9"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Two offset rounded squares — the desktop's `Clipboard`. */
export function ClipboardIcon({ size = 16, color }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 12.9v4.2c0 3.5-1.4 4.9-4.9 4.9H6.9C3.4 22 2 20.6 2 17.1v-4.2C2 9.4 3.4 8 6.9 8h4.2c3.5 0 4.9 1.4 4.9 4.9Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 6.9v4.2c0 3.5-1.4 4.9-4.9 4.9H16v-3.1C16 9.4 14.6 8 11.1 8H8V6.9C8 3.4 9.4 2 12.9 2h4.2C20.6 2 22 3.4 22 6.9Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The acknowledgement after a copy — the desktop's `Check`. */
export function CheckIcon({ size = 16, color }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m4 12 4.95 4.95L19.557 6.343"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
