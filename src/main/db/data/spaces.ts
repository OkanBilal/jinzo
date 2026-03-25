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
      lightBackground: "#f2dbcf",
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
    id: "copilot",
    name: "Copilot",
    slug: "copilot",
    icon: "icon:copilot",
    systemPrompt: "",
    themeConfig: {
      lightBackground: "#dae6f0",
      darkBackground: "#11131abf",
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
    sortOrder: 1,
  },
  {
    id: "codex",
    name: "Codex",
    slug: "codex",
    icon: "icon:codex",
    systemPrompt: "",
    themeConfig: {
      lightBackground: "#d5dde5",
      darkBackground: "#0d1117bf",
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
    sortOrder: 2,
  },
];
