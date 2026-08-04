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

/**
 * Provider brand marks. They stay in `iconRegistry` so already-saved values
 * (`icon:claude`, …) keep resolving through `parseIcon`, but they are not
 * offered as manual choices — a provider mark on a project or space would read
 * as a runtime badge rather than a user-picked icon.
 */
const providerIconNames = new Set(["claude", "copilot", "codex", "cursor"]);

/** Icons offered in the icon picker grid. */
export const availableIcons = Object.entries(iconRegistry)
  .filter(([name]) => !providerIconNames.has(name))
  .map(([name, component]) => ({
    name,
    component,
  }));

export interface IconColorOption {
  name: string;
  label: string;
  /** Class for the swatch dot in the picker. */
  swatch: string;
  /** Class applied to the rendered icon; empty means "inherit the call site". */
  className: string;
}

/**
 * Tints available for registry icons (emoji carry their own color). Stored as a
 * name rather than a hex value so each tint can resolve differently in light and
 * dark themes instead of turning invisible in one of them.
 */
export const ICON_COLORS: IconColorOption[] = [
  {
    name: "default",
    label: "Default",
    swatch: "bg-primary-900 dark:bg-primary-100",
    className: "",
  },
  { name: "red", label: "Red", swatch: "bg-red-500", className: "text-red-500" },
  {
    name: "orange",
    label: "Orange",
    swatch: "bg-orange-500",
    className: "text-orange-500",
  },
  {
    name: "amber",
    label: "Amber",
    swatch: "bg-amber-400",
    className: "text-amber-500 dark:text-amber-400",
  },
  {
    name: "green",
    label: "Green",
    swatch: "bg-green-500",
    className: "text-green-600 dark:text-green-500",
  },
  {
    name: "blue",
    label: "Blue",
    swatch: "bg-blue-500",
    className: "text-blue-500",
  },
  {
    name: "purple",
    label: "Purple",
    swatch: "bg-purple-400",
    className: "text-purple-500 dark:text-purple-400",
  },
  {
    name: "pink",
    label: "Pink",
    swatch: "bg-pink-400",
    className: "text-pink-500 dark:text-pink-400",
  },
];

export const DEFAULT_ICON_COLOR = "default";

/** Text class for a stored color name; empty for default / unknown values. */
export function iconColorClass(color: string | null | undefined): string {
  if (!color) return "";
  return ICON_COLORS.find((c) => c.name === color)?.className ?? "";
}

type ParsedIcon =
  | { type: "emoji"; value: string }
  | { type: "icon"; value: IconComponent; color?: string };

/** Splits the stored `<name>|<color>` form; color is optional. */
function splitIconToken(token: string): { name: string; color?: string } {
  const [name, color] = token.split("|");
  return {
    name: name.trim().toLowerCase(),
    color: color?.trim().toLowerCase() || undefined,
  };
}

/**
 * Builds the value persisted in the `icon` column. The default tint is omitted
 * so untinted icons keep the original `icon:<name>` form.
 */
export function formatIcon(
  mode: "emoji" | "icon",
  value: string,
  color?: string,
): string | null {
  if (!value) return null;
  if (mode === "emoji") return `emoji:${value}`;
  return color && color !== DEFAULT_ICON_COLOR
    ? `icon:${value}|${color}`
    : `icon:${value}`;
}

export function parseIcon(iconString: string | null | undefined): ParsedIcon {
  if (!iconString) {
    return { type: "emoji", value: "💬" };
  }

  if (iconString.startsWith("icon:")) {
    const { name, color } = splitIconToken(iconString.slice("icon:".length));
    const Icon = iconRegistry[name];
    return Icon
      ? { type: "icon", value: Icon, color }
      : { type: "emoji", value: "⌘" };
  }

  if (iconString.startsWith("emoji:")) {
    return { type: "emoji", value: iconString.slice("emoji:".length) };
  }

  const { name, color } = splitIconToken(iconString);
  const Icon = iconRegistry[name];
  if (Icon) return { type: "icon", value: Icon, color };

  return { type: "emoji", value: iconString };
}

export default iconRegistry;
