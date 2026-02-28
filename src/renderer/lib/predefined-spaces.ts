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
    id: "journal",
    name: "Journal",
    icon: "icon:textitalic",
    theme: theme("#E6C7E699", "#2D1F33"),
    systemPrompt:
      "You are a creative writing assistant. Help the user with writing tasks including drafting, editing, brainstorming ideas, and improving prose. Focus on clarity, style, and engaging content.",
    uiConfig: {
      sidebar: { title: "Post", itemType: "post", defaultRoute: "/journal" },
      rightPanel: { width: "30rem", component: "journal" },
    },
  },
  {
    id: "claude",
    name: "Claude",
    icon: "icon:claude",
    theme: theme("#fcc7b6", "#141415"),
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
    theme: theme("#c8ddf1", "#11131a"),
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
];
