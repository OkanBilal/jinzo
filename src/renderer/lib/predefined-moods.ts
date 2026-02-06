import type { ThemeVariant } from "./mood-themes";
export interface PredefinedMoodTheme {
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

export interface PredefinedMoodUIConfig {
  sidebar?: SidebarConfig;
  main?: MainConfig;
  rightPanel?: RightPanelConfig;
}

export interface PredefinedMood {
  id: string;
  name: string;
  icon: string;
  theme: PredefinedMoodTheme;
  systemPrompt: string;
  uiConfig?: PredefinedMoodUIConfig;
}

const theme = (light: string, dark: string): PredefinedMoodTheme => ({
  light: { value: light, preview: light.replace(/[0-9a-f]{2}$/i, "") || light },
  dark: { value: dark, preview: dark },
});

const WORKSPACE_UI: PredefinedMoodUIConfig = {
  sidebar: {
    width: "19rem",
    title: "Workspace",
    itemType: "workspace",
    defaultRoute: "/workspace",
  },
  main: { margin: "19rem" },
  rightPanel: { width: "19rem", component: "workspace" },
};

export const predefinedMoods: PredefinedMood[] = [
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
    theme: theme("#fcc7b699", "#161210"),
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "19rem",
        title: "Workspace",
        itemType: "workspace",
        defaultRoute: "/claude",
      },
      main: { margin: "19rem" },
      rightPanel: { width: "19rem", component: "workspace" },
    },
  },
  {
    id: "copilot",
    name: "Copilot",
    icon: "icon:copilot",
    theme: theme("#FFFFFF40", "#11131a"),
    systemPrompt: "",
    uiConfig: WORKSPACE_UI,
  },
  {
    id: "health",
    name: "Health",
    icon: "icon:heart",
    theme: theme("#fde2e2", "#3b1d21"),
    systemPrompt: "",
  },
];

export const getMoodById = (id: string): PredefinedMood | undefined =>
  predefinedMoods.find((mood) => mood.id === id);

export const getMoodIds = (): string[] => predefinedMoods.map((m) => m.id);
