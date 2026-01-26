/**
 * Predefined mood templates for quick creation
 */

export interface PredefinedMoodTheme {
  light: { value: string; preview: string };
  dark: { value: string; preview: string };
}

export interface PredefinedMoodUIConfig {
  sidebar?: {
    width?: string;
    title?: string;
    itemType?: string;
    defaultRoute?: string;
  };
  main?: {
    margin?: string;
  };
  rightPanel?: {
    width?: string;
    component?: string;
  };
}

export interface PredefinedMood {
  id: string;
  name: string;
  icon: string;
  theme: PredefinedMoodTheme;
  systemPrompt: string;
  uiConfig?: PredefinedMoodUIConfig;
}

export const predefinedMoods: PredefinedMood[] = [
  {
    id: "journal",
    name: "Journal",
    icon: "icon:textitalic",
    theme: {
      light: { value: "#E6C7E699", preview: "#E6C7E6" },
      dark: { value: "#2D1F33", preview: "#2D1F33" },
    },
    systemPrompt:
      "You are a creative writing assistant. Help the user with writing tasks including drafting, editing, brainstorming ideas, and improving prose. Focus on clarity, style, and engaging content.",
    uiConfig: {
      sidebar: {
        title: "Post",
        itemType: "post",
        defaultRoute: "/doc",
      },
      rightPanel: {
        width: "30rem",
        component: "journal",
      },
    },
  },
  {
    id: "claude",
    name: "Claude",
    icon: "icon:claude",
    theme: {
      light: { value: "#fcc7b699", preview: "#fcc7b6" },
      dark: { value: "#63341f", preview: "#63341f" },
    },
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "20rem",
        title: "Workspace",
        itemType: "claude",
        defaultRoute: "/claude",
      },
      main: {
        margin: "20rem",
      },
    },
  },

  {
    id: "copilot",
    name: "Copilot",
    icon: "icon:copilot",
    theme: {
      light: { value: "#FFFFFF99", preview: "#FFFFFF" },
      dark: { value: "#090c10", preview: "#090c10" },
    },
    systemPrompt: "",
    uiConfig: {
      sidebar: {
        width: "20rem",
        title: "Workspace",
        itemType: "workspace",
        defaultRoute: "/workspace",
      },
      main: {
        margin: "20rem",
      },
    },
  },
];
