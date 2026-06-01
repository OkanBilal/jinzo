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
      lightBackground: "#ffffffb3",
      darkBackground: "#00000070",
    },
    uiConfig: {
      sidebar: {
        title: "Project",
        itemType: "workspace",
        defaultRoute: "/claude",
      },
      rightPanel: { component: "workspace" },
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
      lightBackground: "#ffffffb3",
      darkBackground: "#00000070",
    },
    uiConfig: {
      sidebar: {
        title: "Project",
        itemType: "workspace",
        defaultRoute: "/codex",
      },
      rightPanel: { component: "workspace" },
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
      lightBackground: "#ffffffb3",
      darkBackground: "#00000070",
    },
    uiConfig: {
      sidebar: {
        title: "Project",
        itemType: "workspace",
        defaultRoute: "/copilot",
      },
      rightPanel: { component: "workspace" },
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
      lightBackground: "#ffffffb3",
      darkBackground: "#00000070",
    },
    uiConfig: {
      sidebar: {
        title: "Project",
        itemType: "workspace",
        defaultRoute: "/cursor",
      },
      rightPanel: { component: "workspace" },
    },
    sortOrder: 3,
  },
];
