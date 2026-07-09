import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useGetProviderPluginsQuery } from "@/lib/redux/api";
import { PROVIDER_IDS } from "../../../../shared/provider-ids";

/**
 * Visual identity for a codex plugin, keyed by the slug that shows up in tool
 * names (`mcp__<slug>__<tool>`) and skill names (`<slug>:<skill>`).
 */
export interface PluginLogo {
  slug: string;
  name: string;
  displayName?: string;
  /** Remote logo URL from `interface.logo`. */
  logo?: string;
  /** Hex brand color from `interface.brandColor`, used for the monogram fallback. */
  brandColor?: string;
}

/**
 * Collapse a slug to a separator-agnostic key so the spelling on the tool name
 * (`google calendar`, from the `codex_apps` sub-provider) matches the plugin's
 * own name (`google-calendar`). Both fold to `googlecalendar`.
 */
export function normalizeSlug(raw: string): string {
  return raw.toLowerCase().replace(/[\s._-]+/g, "");
}

const EMPTY_MAP: ReadonlyMap<string, PluginLogo> = new Map();

const PluginLogoContext =
  createContext<ReadonlyMap<string, PluginLogo>>(EMPTY_MAP);

/**
 * Builds a `slug → PluginLogo` map from the codex plugin marketplace so tool /
 * skill renderers can swap the generic MCP icon for the plugin's real logo.
 *
 * Only fetches when the active run is codex (the only provider with a plugin
 * marketplace); for every other provider the query is skipped and consumers
 * fall back to their static icons via the empty default context. The query is
 * RTK-cached, so the cost is a single fetch shared with the settings page.
 */
export function PluginLogoProvider({
  providerId,
  children,
}: {
  providerId: string;
  children: ReactNode;
}) {
  const isCodex = providerId === PROVIDER_IDS.codex;
  const { data } = useGetProviderPluginsQuery(PROVIDER_IDS.codex, {
    skip: !isCodex,
  });

  const map = useMemo(() => {
    const m = new Map<string, PluginLogo>();
    if (!data) return m;
    for (const mp of data.marketplaces) {
      for (const p of mp.plugins) {
        const logo = p.interface?.logo;
        const brandColor = p.interface?.brandColor;
        // Nothing to render → don't shadow the static icon with a blank entry.
        if (!logo && !brandColor) continue;
        const displayName = p.interface?.displayName;
        // The MCP server prefix / skill prefix is the plugin name; index by it
        // plus the id-base (`netlify@openai` → `netlify`), both normalized so
        // separator-mismatched spellings still resolve.
        const keys = new Set<string>();
        if (p.name) keys.add(normalizeSlug(p.name));
        const idBase = p.id?.split("@")[0];
        if (idBase) keys.add(normalizeSlug(idBase));
        for (const slug of keys) {
          if (slug && !m.has(slug)) {
            m.set(slug, { slug, name: p.name, displayName, logo, brandColor });
          }
        }
      }
    }
    return m;
  }, [data]);

  return (
    <PluginLogoContext.Provider value={map}>
      {children}
    </PluginLogoContext.Provider>
  );
}

/** Lookup map of codex plugin logos; empty when no `PluginLogoProvider` is mounted. */
export function usePluginLogoMap(): ReadonlyMap<string, PluginLogo> {
  return useContext(PluginLogoContext);
}

/**
 * Render a plugin's icon: the remote logo when present, otherwise a brand-color
 * monogram. Returns `null` when there's nothing to show so callers can fall
 * back to their static icon.
 */
export function renderPluginIcon(
  plugin: PluginLogo | undefined,
  sizeClass = "size-4",
): ReactNode | null {
  if (!plugin) return null;
  const label = plugin.displayName || plugin.name;
  if (plugin.logo) {
    return (
      <img
        src={plugin.logo}
        alt={label}
        className={`${sizeClass} rounded object-cover shrink-0`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    );
  }
  return (
    <span
      className={`${sizeClass} rounded flex items-center justify-center text-xt font-semibold text-white shrink-0`}
      style={{ backgroundColor: plugin.brandColor }}
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}
