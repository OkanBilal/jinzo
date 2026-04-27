// ─────────────────────────────────────────────────────────────
// Default Spaces Seed Data
// ─────────────────────────────────────────────────────────────

export interface SeedSpace {
  id: string;
  name: string;
  slug: string;
  icon: string;
  systemPrompt: string;
  themeConfig: {
    lightBackground: string;
    darkBackground: string;
  };
  uiConfig: Record<string, unknown>;
  sortOrder: number;
}

export const seedSpaces: SeedSpace[] = [
  {
    id: "claude",
    name: "Claude",
    slug: "claude",
    icon: "icon:claude",
    systemPrompt: "",
    themeConfig: {
      lightBackground: "#f2dbcfa6",
      darkBackground: "#0e0d0dbf",
    },
    uiConfig: {
      sidebar: {
        width: "19rem",
        title: "Repository",
        itemType: "workspace",
        defaultRoute: "/claude",
      },
      main: { margin: "19rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
    sortOrder: 0,
  },

  {
    id: "codex",
    name: "Codex",
    slug: "codex",
    icon: "icon:codex",
    systemPrompt: "",
    themeConfig: {
      lightBackground: "#dcecfaa1",
      darkBackground: "#0c0c0cbd",
    },
    uiConfig: {
      sidebar: {
        width: "19rem",
        title: "Repository",
        itemType: "workspace",
        defaultRoute: "/codex",
      },
      main: { margin: "19rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
    sortOrder: 1,
  },
    {
    id: "copilot",
    name: "Copilot",
    slug: "copilot",
    icon: "icon:copilot",
    systemPrompt: "",
    themeConfig: {
      lightBackground: "#f0e9fab0",
      darkBackground: "#15111abf",
    },
    uiConfig: {
      sidebar: {
        width: "19rem",
        title: "Repository",
        itemType: "workspace",
        defaultRoute: "/copilot",
      },
      main: { margin: "19rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
    sortOrder: 2,
  },
  {
    id: "cursor",
    name: "Cursor",
    slug: "cursor",
    icon: "icon:cursor",
    systemPrompt: "",
    themeConfig: {
      lightBackground: "#cfced2a6",
      darkBackground: "#0f0e14bf",
    },
    uiConfig: {
      sidebar: {
        width: "19rem",
        title: "Repository",
        itemType: "workspace",
        defaultRoute: "/cursor",
      },
      main: { margin: "19rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
    sortOrder: 3,
  },
];
