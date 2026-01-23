import { ComponentType, SVGProps } from "react";
import * as Icons from "@/components/ui/icons/mood";

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const iconRegistry: Record<string, IconComponent> = {
    academy: Icons.Academy,
    backpack: Icons.Backpack,
    basketball: Icons.Basketball,
    bolt: Icons.Bolt,
    bookmark: Icons.Bookmark,
    broadcast: Icons.Broadcast,
    calendar: Icons.Calendar,
    chat: Icons.Chat,
    cloud: Icons.Cloud,
    code: Icons.Code,
    compass: Icons.Compass,
    dumbbell: Icons.Dumbbell,
    earth: Icons.Earth,
    gallery: Icons.Gallery,
    gamepad: Icons.Gamepad,
    globe: Icons.Globe,
    heart: Icons.Heart,
    home: Icons.Home,
    incognito: Icons.Incognito,
    mitts: Icons.Mitts,
    price: Icons.Price,
    rocket: Icons.Rocket,
    scan: Icons.Scan,
    smile: Icons.Smile,
    star: Icons.Star,
    sun: Icons.Sun,
    textcross: Icons.Textcross,
    textitalic: Icons.Textitalic,
    user: Icons.User,
    vinyl: Icons.Vinyl,
    opencode: Icons.Opencode,
    claude: Icons.Claude,
};

// Icons available for mood selection - derived from iconRegistry
export const availableIcons = Object.entries(iconRegistry).map(([name, component]) => ({
  name,
  component,
}));

/**
 * Parse icon string and return either an emoji or an icon component
 * Supports formats:
 * - "icon:agent" -> Agent icon component
 * - "emoji:🎯" or "🎯" -> Emoji
 */
export function parseIcon(iconString: string | null | undefined): {
  type: "emoji" | "icon";
  value: string | IconComponent;
} {
  if (!iconString) {
    return { type: "emoji", value: "💬" };
  }

  // Check for explicit prefix
  if (iconString.startsWith("icon:")) {
    const iconName = iconString.replace("icon:", "").toLowerCase();
    const IconComponent = iconRegistry[iconName];
    if (IconComponent) {
      return { type: "icon", value: IconComponent };
    }
    // Fallback to emoji if icon not found
    return { type: "emoji", value: "⌘" };
  }

  if (iconString.startsWith("emoji:")) {
    return { type: "emoji", value: iconString.replace("emoji:", "") };
  }

  // Try to detect if it's an icon name (lowercase alphanumeric)
  const lowerIcon = iconString.toLowerCase();
  if (iconRegistry[lowerIcon]) {
    return { type: "icon", value: iconRegistry[lowerIcon] };
  }

  // Default: treat as emoji
  return { type: "emoji", value: iconString };
}

export default iconRegistry;
