import { ComponentType, SVGProps } from "react";
import * as Icons from "@/components/ui/icons/space";

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
  copilot: Icons.Copilot,
};

export const availableIcons = Object.entries(iconRegistry).map(
  ([name, component]) => ({
    name,
    component,
  }),
);

export function parseIcon(iconString: string | null | undefined): {
  type: "emoji" | "icon" | "copilot-animate" | "claude-animate";
  value: string | IconComponent;
} {
  if (!iconString) {
    return { type: "emoji", value: "💬" };
  }

  if (iconString.startsWith("icon:")) {
    const iconName = iconString.replace("icon:", "").toLowerCase();
    const IconComponent = iconRegistry[iconName];
    if (IconComponent) {
      if (iconName === "copilot") {
        return { type: "copilot-animate", value: IconComponent };
      }
      if (iconName === "claude") {
        return { type: "claude-animate", value: IconComponent };
      }
      return { type: "icon", value: IconComponent };
    }
    return { type: "emoji", value: "⌘" };
  }

  if (iconString.startsWith("emoji:")) {
    return { type: "emoji", value: iconString.replace("emoji:", "") };
  }

  const lowerIcon = iconString.toLowerCase();
  if (iconRegistry[lowerIcon]) {
    if (lowerIcon === "copilot") {
      return { type: "copilot-animate", value: iconRegistry[lowerIcon] };
    }
    if (lowerIcon === "claude") {
      return { type: "claude-animate", value: iconRegistry[lowerIcon] };
    }
    return { type: "icon", value: iconRegistry[lowerIcon] };
  }

  return { type: "emoji", value: iconString };
}

export default iconRegistry;
