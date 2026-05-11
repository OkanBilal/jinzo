/**
 * Wire shape of the `space.uiConfig` JSON blob — both ends (DB-read parse &
 * predefined-space seed definitions) share these types so the schema lives
 * in one place.
 */

export interface ParsedSidebarConfig {
  width?: string;
  title?: string;
  itemType?: string;
  defaultRoute?: string;
}

export interface ParsedMainConfig {
  margin?: string;
}

export interface ParsedRightPanelConfig {
  width?: string;
  component?: string;
}

/**
 * Shape of `space.uiConfig` after parsing — every field optional because the
 * blob is user/template-defined and may be partial. Hooks layer their defaults
 * on top.
 */
export interface ParsedUiConfig {
  sidebar?: ParsedSidebarConfig;
  main?: ParsedMainConfig;
  rightPanel?: ParsedRightPanelConfig;
}

/**
 * Parses the JSON blob stored in `space.uiConfig`. Returns `{}` for missing,
 * malformed, or null input so callers can read with optional chaining safely.
 */
export function parseUiConfig(raw: string | null | undefined): ParsedUiConfig {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ParsedUiConfig;
  } catch (err) {
    console.error("Failed to parse space uiConfig:", err);
    return {};
  }
}
