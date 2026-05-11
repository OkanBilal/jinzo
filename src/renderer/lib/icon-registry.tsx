import { ComponentType, SVGProps } from "react";
import * as Icons from "@/components/ui/icons/space";
import { Codex, Cursor } from "@/components/ui/icons";

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
  claude: Icons.Claude,
  copilot: Icons.Copilot,
  codex: Codex,
  cursor: Cursor,
};

export const availableIcons = Object.entries(iconRegistry).map(
  ([name, component]) => ({
    name,
    component,
  }),
);

type ParsedIcon =
  | { type: "emoji"; value: string }
  | { type: "icon"; value: IconComponent };

export function parseIcon(iconString: string | null | undefined): ParsedIcon {
  if (!iconString) {
    return { type: "emoji", value: "💬" };
  }

  if (iconString.startsWith("icon:")) {
    const iconName = iconString.replace("icon:", "").toLowerCase();
    const Icon = iconRegistry[iconName];
    return Icon ? { type: "icon", value: Icon } : { type: "emoji", value: "⌘" };
  }

  if (iconString.startsWith("emoji:")) {
    return { type: "emoji", value: iconString.replace("emoji:", "") };
  }

  const lowerIcon = iconString.toLowerCase();
  const Icon = iconRegistry[lowerIcon];
  if (Icon) return { type: "icon", value: Icon };

  return { type: "emoji", value: iconString };
}

export default iconRegistry;
