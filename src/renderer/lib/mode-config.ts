// ─────────────────────────────────────────────────────────────
// Mode-config descriptor
//
// One table answering "what does the app look like in mode X?" — sidebar,
// right panel, default route. The sibling of `provider-variants.ts`: that
// table shapes the UI per agent *engine*, this one per *experience*
// (developer / work / chat, see `src/shared/modes.ts`).
//
// This is code, not data: the values were identical across every space row
// when they lived in the `spaces.uiConfig` JSON blob, so they moved here
// where a change shows up in a diff and a typo fails to compile. Anything
// that genuinely varies per space lives as a typed column on `spaces`
// (`providerId`, `mode`, `themeConfig`, ...).
// ─────────────────────────────────────────────────────────────

import { DEFAULT_MODE_ID, type ModeId } from "../../shared/modes";

export type SidebarItemType = "workspace";

export interface ModeSidebarConfig {
  title: string;
  itemType: SidebarItemType;
  defaultRoute: string;
}

export interface ModeRightPanelConfig {
  /** Key into `PANEL_COMPONENTS` (right-panel/panel-components.ts). */
  component: string;
}

export interface ModeConfigDescriptor {
  mode: ModeId;
  sidebar: ModeSidebarConfig;
  rightPanel: ModeRightPanelConfig;
}

export const MODE_CONFIGS: Record<ModeId, ModeConfigDescriptor> = {
  developer: {
    mode: "developer",
    sidebar: { title: "Project", itemType: "workspace", defaultRoute: "/code" },
    rightPanel: { component: "workspace" },
  },
  // Work and chat currently mirror developer; they diverge as their surfaces
  // land (work: deliverables panel, non-technical run view; chat: /chat route).
  work: {
    mode: "work",
    sidebar: { title: "Project", itemType: "workspace", defaultRoute: "/code" },
    rightPanel: { component: "workspace" },
  },
  chat: {
    mode: "chat",
    sidebar: { title: "Project", itemType: "workspace", defaultRoute: "/code" },
    rightPanel: { component: "workspace" },
  },
};

/** Descriptor for a mode id; unknown/absent ids resolve to the default mode. */
export function getModeConfig(mode: string | null | undefined): ModeConfigDescriptor {
  return MODE_CONFIGS[(mode as ModeId) ?? DEFAULT_MODE_ID] ?? MODE_CONFIGS[DEFAULT_MODE_ID];
}
