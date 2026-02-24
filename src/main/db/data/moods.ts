// ─────────────────────────────────────────────────────────────
// Default Moods Seed Data
// ─────────────────────────────────────────────────────────────

export interface SeedMood {
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

export const seedMoods: SeedMood[] = [
  // {
  //   id: "chat",
  //   name: "Chat",
  //   slug: "chat",
  //   icon: "icon:chat",
  //   systemPrompt: "",
  //   themeConfig: {
  //     lightBackground: "#ffffff70",
  //     darkBackground: "#00000070",
  //   },
  //   uiConfig: {
  //     sidebar: {
  //       title: "Chat",
  //       itemType: "chat",
  //       defaultRoute: "/",
  //     },
  //   },
  //   sortOrder: 0,
  // },
  {
    id: "claude",
    name: "Claude",
    slug: "claude",
    icon: "icon:claude",
    systemPrompt: "",
    themeConfig: {
      lightBackground: "#D97757",
      darkBackground: "#151414cc",
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
      lightBackground: "#c8ddf1",
      darkBackground: "#11131ac7",
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
];
