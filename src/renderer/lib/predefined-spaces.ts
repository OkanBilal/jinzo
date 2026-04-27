import type { ThemeVariant } from "./space-themes";
export interface PredefinedSpaceTheme {
  light: ThemeVariant;
  dark: ThemeVariant;
}

export interface SidebarConfig {
  width?: string;
  title?: string;
  itemType?: string;
  defaultRoute?: string;
}

export interface MainConfig {
  margin?: string;
}

export interface RightPanelConfig {
  width?: string;
  component?: string;
}

export interface PredefinedSpaceUIConfig {
  sidebar?: SidebarConfig;
  main?: MainConfig;
  rightPanel?: RightPanelConfig;
}

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
    theme: theme("#f2dbcfa6", "#0e0d0dbf"),
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "19rem",
        title: "Workspace",
        itemType: "workspace",
        defaultRoute: "/claude",
      },
      main: { margin: "19rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
  },
  {
    id: "copilot",
    name: "Copilot",
    icon: "icon:copilot",
    theme: theme("#f0e9fab0", "#15111abf"),
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "19rem",
        title: "Workspace",
        itemType: "workspace",
        defaultRoute: "/copilot",
      },
      main: { margin: "19rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
  },
  {
    id: "codex",
    name: "Codex",
    icon: "icon:code",
    theme: theme("#dcecfaa1", "#0c0c0cbd"),
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "19rem",
        title: "Workspace",
        itemType: "workspace",
        defaultRoute: "/codex",
      },
      main: { margin: "19rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: "icon:cursor",
    theme: theme("#cfced2a6", "#0f0e14bf"),
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "19rem",
        title: "Workspace",
        itemType: "workspace",
        defaultRoute: "/cursor",
      },
      main: { margin: "19rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
  },
];

