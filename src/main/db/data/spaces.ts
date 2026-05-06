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
      lightBackground: "#ffffff40",
      darkBackground: "#00000070",
    },
    uiConfig: {
      sidebar: {
        width: "18rem",
        title: "Project",
        itemType: "workspace",
        defaultRoute: "/claude",
      },
      main: { margin: "18rem" },
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
      lightBackground: "#ffffff40",
      darkBackground: "#00000070",
    },
    uiConfig: {
      sidebar: {
        width: "18rem",
        title: "Project",
        itemType: "workspace",
        defaultRoute: "/codex",
      },
      main: { margin: "18rem" },
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
      lightBackground: "#ffffff40",
      darkBackground: "#00000070",
    },
    uiConfig: {
      sidebar: {
        width: "18rem",
        title: "Project",
        itemType: "workspace",
        defaultRoute: "/copilot",
      },
      main: { margin: "18rem" },
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
      lightBackground: "#ffffff40",
      darkBackground: "#00000070",
    },
    uiConfig: {
      sidebar: {
        width: "18rem",
        title: "Project",
        itemType: "workspace",
        defaultRoute: "/cursor",
      },
      main: { margin: "18rem" },
      rightPanel: { width: "22rem", component: "workspace" },
    },
    sortOrder: 3,
  },
];
