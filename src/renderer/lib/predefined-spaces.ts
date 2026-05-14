import type { ThemeVariant } from "./space-themes";
import type { ParsedUiConfig } from "./parse-ui-config";

export interface PredefinedSpaceTheme {
  light: ThemeVariant;
  dark: ThemeVariant;
}

/**
 * Predefined spaces share the wire shape with the runtime parse result —
 * see `ParsedUiConfig` in `parse-ui-config.ts`. The alias keeps callers'
 * intent ("this is a seed value") clear without duplicating the type.
 */
export type PredefinedSpaceUIConfig = ParsedUiConfig;

export interface PredefinedSpace {
  id: string;
  name: string;
  icon: string;
  theme: PredefinedSpaceTheme;
  systemPrompt: string;
  uiConfig?: PredefinedSpaceUIConfig;
}

const theme = (light: string, dark: string): PredefinedSpaceTheme => ({
  light: { value: light, preview: light.replace(/[0-9a-f]{2}$/i, "") || light },
  dark: { value: dark, preview: dark },
});

export const predefinedSpaces: PredefinedSpace[] = [
  {
    id: "claude",
    name: "Claude",
    icon: "icon:claude",
    theme: theme("#ffffff40", "#00000070"),
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "18rem",
        title: "Workspace",
        itemType: "workspace",
        defaultRoute: "/claude",
      },
      main: { margin: "18rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
  },
  {
    id: "copilot",
    name: "Copilot",
    icon: "icon:copilot",
    theme: theme("#ffffff40", "#00000070"),
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "18rem",
        title: "Workspace",
        itemType: "workspace",
        defaultRoute: "/copilot",
      },
      main: { margin: "18rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
  },
  {
    id: "codex",
    name: "Codex",
    icon: "icon:code",
    theme: theme("#ffffff40", "#00000070"),
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "18rem",
        title: "Workspace",
        itemType: "workspace",
        defaultRoute: "/codex",
      },
      main: { margin: "18rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: "icon:cursor",
    theme: theme("#ffffff40", "#00000070"),
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "18rem",
        title: "Workspace",
        itemType: "workspace",
        defaultRoute: "/cursor",
      },
      main: { margin: "18rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
  },
];

