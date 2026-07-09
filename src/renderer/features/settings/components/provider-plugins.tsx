import { useState, useMemo, useCallback } from "react";
import {
  Heading2,
  Heading3,
  Body,
  Muted,
  Button,
  CopyButton,
  toast,
  AsciiSpinner,
  Select,
} from "@/components/ui";
import {
  useGetProviderPluginsQuery,
  useReadProviderPluginQuery,
  useInstallProviderPluginMutation,
  useUninstallProviderPluginMutation,
  useSetProviderPluginEnabledMutation,
  useUpdateProviderPluginMutation,
} from "@/lib/redux/api";
import type { PluginInfo, PluginScope } from "@/lib/redux/api";
import { PROVIDER_IDS } from "../../../../shared/provider-ids";
import { extractErrorMessage } from "@/lib/extract-error-message";
import {
  Search,
  Check,
  Apps,
  Sparkles,
  External,
  Plus,
  ArrowUp,
} from "@/components/ui/icons";

// ── Helpers ──

/** Format technical include names to human-readable titles.
 *  "github:gh-address-comments" → "Address Comments"
 *  "connector_76869538..." → "GitHub" (fallback to plugin name)
 *  "linear:linear" → "Linear"
 */
function formatIncludeName(raw: string): string {
  // Strip prefix like "github:", "linear:" etc.
  const afterColon = raw.includes(":") ? raw.split(":").pop()! : raw;
  // Strip common prefixes like "gh-", "asdk_app_", "connector_"
  let cleaned = afterColon
    .replace(/^(gh-|asdk_app_|connector_)[a-f0-9]{20,}$/i, "") // hash-only IDs → empty
    .replace(/^gh-/, "")
    .replace(/^asdk_app_.*$/, "")
    .replace(/^connector_.*$/, "");
  if (!cleaned) {
    // Fallback: use the part before ":"
    cleaned = raw.includes(":") ? raw.split(":")[0] : raw;
  }
  // Convert kebab-case to Title Case
  return cleaned
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Common acronyms to upper-case when humanizing slug-style plugin names. */
const PLUGIN_NAME_ACRONYMS = new Set([
  "ai", "api", "aws", "cli", "css", "db", "etl", "gcp", "html", "http", "id",
  "io", "js", "json", "jwt", "k8s", "llm", "mcp", "ml", "pdf", "sdk", "sql",
  "ssh", "ui", "ux", "url", "s3", "gpu", "cpu", "sso", "crm", "orm",
]);

/** "agent-sdk-dev" → "Agent SDK Dev". Used when a plugin has no displayName
 *  (Claude marketplace plugins are slug-named). Codex plugins keep their own
 *  displayName, so this only ever runs on the raw-name fallback. */
function humanizePluginName(raw: string): string {
  const words = raw
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      if (PLUGIN_NAME_ACRONYMS.has(lower)) return lower.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
  return words.length ? words.join(" ") : raw;
}

/** "database" → "Database", "machine-learning" → "Machine Learning". */
function formatCategory(cat: string): string {
  return cat
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Compact install-count label: 940 → "940", 2293 → "2.3k", 948012 → "948k". */
function formatInstalls(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Deterministic avatar background for plugins without a brand color (e.g.
 *  Claude marketplace plugins, which publish no logo/brandColor). Same key →
 *  same hue, so the grid is colorful but stable. Dark enough for white text. */
function pluginAvatarColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 50% 45%)`;
}

function PluginLogo({
  plugin,
  size = "md",
}: {
  plugin: PluginInfo;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "size-14" : size === "md" ? "size-8" : "size-8";
  const roundedClass = size === "lg" ? "rounded-2xl" : "rounded-xl";
  const textSize =
    size === "lg" ? "text-xl" : size === "md" ? "text-sm" : "text-xs";
  const brandColor = plugin.interface?.brandColor;
  const logo = plugin.interface?.logo;
  const name = plugin.interface?.displayName || humanizePluginName(plugin.name);
  // No brand color (Claude plugins) → derive a stable color from the id so each
  // plugin gets a distinct avatar instead of an identical grey one.
  const generatedColor = brandColor ? null : pluginAvatarColor(plugin.id || plugin.name);

  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        className={`${sizeClass} ${roundedClass} object-cover shrink-0`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${roundedClass} flex items-center justify-center font-semibold ${textSize} text-primary shrink-0`}
      style={{ backgroundColor: brandColor || generatedColor || "var(--color-primary-500)" }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Plugin Card (Connection-style) ──

function PluginCard({
  plugin,
  onSelect,
  onInstall,
  onUninstall,
  isInstalling,
}: {
  plugin: PluginInfo;
  onSelect: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  isInstalling: boolean;
}) {
  const name = plugin.interface?.displayName || humanizePluginName(plugin.name);
  const description = plugin.interface?.shortDescription || "";

  return (
    <div
      className="rounded-3xl glass-morphism px-4 py-6 cursor-pointer hover:bg-primary-200/60 dark:hover:bg-primary/5 transition-colors flex items-center gap-3"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect();
      }}
    >
      <PluginLogo plugin={plugin} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-primary-900 dark:text-primary-100 truncate">
            {name}
          </span>
          {plugin.installed && !plugin.enabled && (
            <span className="shrink-0 text-t px-1.5 py-0.5 rounded-full bg-primary-200/60 dark:bg-primary-800/40 text-primary-500 dark:text-primary-400">
              Disabled
            </span>
          )}
          {plugin.updateAvailable && (
            <span className="shrink-0 text-t px-1.5 py-0.5 rounded-full bg-warning/15 text-warning">
              Update
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-primary-500 dark:text-primary-400 min-w-0">
          <span className="truncate">{description}</span>
          {typeof plugin.installs === "number" && plugin.installs > 0 && (
            <span className="shrink-0 tabular-nums opacity-70">
              {formatInstalls(plugin.installs)} installs
            </span>
          )}
        </div>
      </div>
      <Button
        type="button"
        className={`shrink-0 size-8 flex items-center justify-center rounded-full text-lg transition-colors cursor-pointer ${
          plugin.installed
            ? "bg-success/15 text-success"
            : "bg-primary-200/60 dark:bg-primary-800/20 text-primary-500 dark:text-primary-400 hover:bg-primary-300/60 dark:hover:bg-primary-700/30"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          if (plugin.installed) {
            onUninstall();
          } else {
            onInstall();
          }
        }}
        disabled={isInstalling || plugin.installPolicy === "NOT_AVAILABLE"}
      >
        {isInstalling ? (
          <div className="mb-1 px-1.5">
            <AsciiSpinner variant="null" />
          </div>
        ) : plugin.installed ? (
          <Check className="size-4" />
        ) : (
          <Plus className="size-4" />
        )}
      </Button>
    </div>
  );
}

// ── Plugin Detail ──

function PluginDetail({
  plugin,
  providerId,
  marketplacePath,
  onBack,
  onInstall,
  onUninstall,
  onToggleEnabled,
  onUpdate,
  installScope,
  onScopeChange,
  isInstalling,
  isToggling,
  isUpdating,
}: {
  plugin: PluginInfo;
  providerId: string;
  marketplacePath: string;
  onBack: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  onToggleEnabled: () => void;
  onUpdate: () => void;
  installScope: PluginScope;
  onScopeChange: (scope: PluginScope) => void;
  isInstalling: boolean;
  isToggling: boolean;
  isUpdating: boolean;
}) {
  const iface = plugin.interface;
  const name = iface?.displayName || humanizePluginName(plugin.name);
  const pluginName = plugin.name || plugin.id.split("@")[0];
  // Scope only applies to Claude's CLI install; Codex has no scope concept.
  const supportsScope = providerId === PROVIDER_IDS.claude;

  const { data: detail } = useReadProviderPluginQuery(
    { providerId, pluginName, marketplacePath },
    { skip: !marketplacePath },
  );
  const hasIncludes =
    detail &&
    (detail.skills.length > 0 ||
      detail.apps.length > 0 ||
      detail.mcpServers.length > 0);

  return (
    <div className="mb-12">
      <Button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-primary-500 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-100 mb-6 cursor-pointer"
      >
        <ArrowUp className="size-4 rotate-270" />
        Back to plugins
      </Button>

      <div className="flex items-start gap-4 mb-6">
        <PluginLogo plugin={plugin} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <Heading2>{name}</Heading2>
            <div className="flex items-center gap-2 shrink-0">
              {!plugin.installed ? (
                <>
                  {supportsScope && (
                    <Select<PluginScope>
                      value={installScope}
                      onChange={onScopeChange}
                      title="Select Scope"
                      options={[
                        { value: "user", label: "User", description: "Global (all projects)" },
                        { value: "project", label: "Project", description: "This project (shared)" },
                        { value: "local", label: "Local", description: "This project (private)" },
                      ]}
                    />
                  )}
                  <Button
                    onClick={onInstall}
                    disabled={isInstalling || plugin.installPolicy === "NOT_AVAILABLE"}
                    variant="primary"
                  >
                    {isInstalling ? (
                      <div className="px-1.5">
                        <AsciiSpinner variant="null" />
                      </div>
                    ) : (
                      "Add"
                    )}
                  </Button>
                </>
              ) : (
                <>
                  {plugin.updateAvailable && (
                    <Button onClick={onUpdate} disabled={isUpdating} variant="primary">
                      {isUpdating ? (
                        <div className="px-1.5">
                          <AsciiSpinner variant="null" />
                        </div>
                      ) : (
                        "Update"
                      )}
                    </Button>
                  )}
                  <Button onClick={onToggleEnabled} disabled={isToggling} variant="secondary">
                    {isToggling ? (
                      <div className="px-1.5">
                        <AsciiSpinner variant="null" />
                      </div>
                    ) : plugin.enabled ? (
                      "Disable"
                    ) : (
                      "Enable"
                    )}
                  </Button>
                  <Button onClick={onUninstall} disabled={isInstalling} variant="secondary">
                    {isInstalling ? (
                      <div className="px-1.5">
                        <AsciiSpinner variant="null" />
                      </div>
                    ) : (
                      "Uninstall"
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Screenshots */}
      {iface?.screenshots && iface.screenshots.length > 0 && (
        <div className="mb-6 overflow-x-auto flex gap-3 pb-2">
          {iface.screenshots.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${name} screenshot ${i + 1}`}
              className="h-48 rounded-xl object-cover"
            />
          ))}
        </div>
      )}

      {/* Long description */}
      {(detail?.description || iface?.longDescription) && (
        <div className="mb-8">
          <Body className="whitespace-pre-wrap">
            {detail?.description || iface?.longDescription}
          </Body>
        </div>
      )}

      {/* Includes (skills, apps, MCP servers) */}
      {hasIncludes && (
        <div className="mb-8">
          <Heading3 className="mb-3">Includes</Heading3>
          <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/20 divide-y divide-primary-200/60 dark:divide-primary-800/20">
            {detail.apps.map((app) => (
              <div key={app.id} className="flex items-center gap-3 px-4 py-3">
                <div className="size-7 rounded-lg bg-primary-200/50 dark:bg-primary-700/30 flex items-center justify-center shrink-0">
                  <Apps className="size-4 text-primary-800 dark:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary-900 dark:text-primary-100">
                    {name}{" "}
                    <span className="text-xs font-normal text-primary-400 dark:text-primary-500 ml-1">
                      App
                    </span>
                  </div>
                  {app.description && (
                    <div className="text-xs text-primary-500 dark:text-primary-400 truncate">
                      {app.description}
                    </div>
                  )}
                </div>
                {app.isEnabled === false ? (
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-primary-200/60 dark:bg-primary-800/20 text-primary-500 dark:text-primary-400">
                    Disabled
                  </span>
                ) : app.isAccessible === true ? (
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">
                    Connected
                  </span>
                ) : app.installUrl ? (
                  <Button
                    variant="icon"
                    className="shrink-0 rounded-lg"
                    onClick={() =>
                      window.api.shell.openExternal(app.installUrl!)
                    }
                  >
                    <External className="size-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            {detail.skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="size-7 rounded-lg bg-primary-200/50 dark:bg-primary-700/30 flex items-center justify-center shrink-0">
                  <Sparkles className="size-4 text-primary-800 dark:text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary-900 dark:text-primary-100">
                    {skill.displayName || formatIncludeName(skill.name)}{" "}
                    <span className="text-xs font-normal text-primary-400 dark:text-primary-500 ml-1">
                      Skill
                    </span>
                  </div>
                  {(skill.shortDescription || skill.description) && (
                    <div className="text-xs text-primary-500 dark:text-primary-400 truncate">
                      {skill.shortDescription || skill.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {detail.mcpServers.map((server) => (
              <div key={server} className="flex items-center gap-3 px-4 py-3">
                <div className="size-8 rounded-lg bg-primary-200/50 dark:bg-primary-700/30 flex items-center justify-center shrink-0">
                  <span className="text-xs text-primary-500 dark:text-primary-400">
                    MCP
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary-900 dark:text-primary-100">
                    {server}{" "}
                    <span className="text-xs font-normal text-primary-400 dark:text-primary-500 ml-1">
                      MCP Server
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capabilities */}
      {iface?.capabilities && iface.capabilities.length > 0 && (
        <div className="mb-8">
          <Heading3 className="mb-3">Capabilities</Heading3>
          <div className="flex flex-wrap gap-2">
            {iface.capabilities.map((cap) => (
              <span
                key={cap}
                className="px-3 py-1 rounded-full text-xs font-medium bg-primary-200/50 dark:bg-primary-700/30 text-primary-700 dark:text-primary-300"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Starter prompts */}
      {iface?.defaultPrompt && iface.defaultPrompt.length > 0 && (
        <div className="mb-8">
          <Heading3 className="mb-3">Starter Prompts</Heading3>
          <div className="space-y-2">
            {iface.defaultPrompt.map((prompt, i) => (
              <PromptRow key={i} prompt={prompt} />
            ))}
          </div>
        </div>
      )}

      {/* Information table */}
      <Heading3 className="mb-3">Information</Heading3>
      <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/20 divide-y divide-primary-200/60 dark:divide-primary-800/20">
        {iface?.category && <InfoRow label="Category" value={iface.category} />}
        {iface?.developerName && (
          <InfoRow label="Developer" value={iface.developerName} />
        )}
        {iface?.websiteUrl && (
          <InfoRow
            label="Website"
            value={
              <a
                href={iface.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 dark:text-blue-400 hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(iface.websiteUrl!, "_blank");
                }}
              >
                {(() => {
                  try {
                    return new URL(iface.websiteUrl!).hostname;
                  } catch {
                    return iface.websiteUrl;
                  }
                })()}
              </a>
            }
          />
        )}
        {iface?.privacyPolicyUrl && (
          <InfoRow
            label="Privacy Policy"
            value={
              <a
                href={iface.privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 dark:text-blue-400 hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(iface.privacyPolicyUrl!, "_blank");
                }}
              >
                View
              </a>
            }
          />
        )}
        {iface?.termsOfServiceUrl && (
          <InfoRow
            label="Terms of Service"
            value={
              <a
                href={iface.termsOfServiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 dark:text-blue-400 hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(iface.termsOfServiceUrl!, "_blank");
                }}
              >
                View
              </a>
            }
          />
        )}
      </div>
    </div>
  );
}

function PromptRow({ prompt }: { prompt: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 group">
      <span className="flex-1 text-sm text-primary-700 dark:text-primary-300">
        {prompt}
      </span>
      <CopyButton
        text={prompt}
        tooltip="Copy"
        copiedTooltip="Copied!"
        variant="bare"
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-primary-400 dark:text-primary-500 hover:text-primary-700 dark:hover:text-primary-200"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-primary-500 dark:text-primary-400">
        {label}
      </span>
      <span className="text-sm font-medium text-primary-900 dark:text-primary-100">
        {value}
      </span>
    </div>
  );
}

const FEATURED_PLUGIN_NAMES = [
  "github",
  "slack",
  "notion",
  "linear",
  "gmail",
  "google-calendar",
  "google-drive",
  "figma",
  "chrome",
  "computer-use"
];

// ── Main Component ──

export default function ProviderPlugins({
  providerId = PROVIDER_IDS.codex,
}: {
  providerId?: string;
} = {}) {
  const {
    data: pluginData,
    isLoading,
    error,
  } = useGetProviderPluginsQuery(providerId);
  const [installPlugin, { isLoading: isInstalling }] =
    useInstallProviderPluginMutation();
  const [uninstallPlugin, { isLoading: isUninstalling }] =
    useUninstallProviderPluginMutation();
  const [setPluginEnabled, { isLoading: isToggling }] =
    useSetProviderPluginEnabledMutation();
  const [updatePlugin, { isLoading: isUpdating }] =
    useUpdateProviderPluginMutation();

  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [installScope, setInstallScope] = useState<PluginScope>("user");

  // Flatten all plugins from all marketplaces (only OpenAI plugins for now)
  const allPlugins = useMemo(() => {
    if (!pluginData) return [];
    return pluginData.marketplaces.flatMap((mp) => mp.plugins);
    //.filter((p) => p.interface?.developerName === "OpenAI" || p.interface?.developerName === "Vercel Labs" );
  }, [pluginData]);

  const featuredIds = useMemo(() => {
    const fromApi = pluginData?.featuredPluginIds ?? [];
    if (fromApi.length > 0) return new Set(fromApi);
    const set = new Set<string>();
    for (const p of allPlugins) {
      const name = p.name || p.id.split("@")[0];
      if (FEATURED_PLUGIN_NAMES.includes(name)) set.add(p.id);
    }
    return set;
  }, [pluginData, allPlugins]);

  // Unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of allPlugins) {
      if (p.interface?.category) cats.add(p.interface.category);
    }
    return Array.from(cats).sort();
  }, [allPlugins]);

  // Filter plugins
  const filteredPlugins = useMemo(() => {
    let result = allPlugins;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.interface?.displayName?.toLowerCase().includes(q) ||
          p.interface?.shortDescription?.toLowerCase().includes(q) ||
          p.interface?.developerName?.toLowerCase().includes(q),
      );
    }
    if (categoryFilter) {
      result = result.filter((p) => p.interface?.category === categoryFilter);
    }
    return result;
  }, [allPlugins, search, categoryFilter]);

  // Highlight row: curated "Featured" when the marketplace provides it, else
  // fall back to the most-installed plugins ("Popular") — useful for Claude,
  // which has no featured list but does report install counts.
  const featured = useMemo(
    () => filteredPlugins.filter((p) => featuredIds.has(p.id)),
    [filteredPlugins, featuredIds],
  );
  const popular = useMemo(() => {
    if (featuredIds.size > 0) return [];
    return [...filteredPlugins]
      .filter((p) => (p.installs ?? 0) > 0)
      .sort((a, b) => (b.installs ?? 0) - (a.installs ?? 0))
      .slice(0, 6);
  }, [filteredPlugins, featuredIds]);
  const highlight = featured.length ? featured : popular;
  const highlightLabel = featured.length ? "Featured" : "Popular";
  const highlightIds = useMemo(() => new Set(highlight.map((p) => p.id)), [highlight]);

  const grouped = useMemo(() => {
    const groups = new Map<string, PluginInfo[]>();
    for (const p of filteredPlugins) {
      if (highlightIds.has(p.id) && !categoryFilter) continue;
      const cat = p.interface?.category || "Other";
      const list = groups.get(cat) ?? [];
      list.push(p);
      groups.set(cat, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPlugins, highlightIds, categoryFilter]);

  const selectedPlugin = useMemo(
    () => allPlugins.find((p) => p.id === selectedPluginId) ?? null,
    [allPlugins, selectedPluginId],
  );

  // Find marketplace path for the selected plugin
  const selectedPluginMarketplacePath = useMemo(() => {
    if (!selectedPluginId || !pluginData) return "";
    for (const mp of pluginData.marketplaces) {
      if (mp.plugins.some((p) => p.id === selectedPluginId)) return mp.path;
    }
    return "";
  }, [selectedPluginId, pluginData]);

  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  const handleInstall = useCallback(
    async (pluginId: string) => {
      setActionInFlight(pluginId);
      try {
        await installPlugin({ providerId, pluginId, scope: installScope }).unwrap();
        toast.success("Plugin installed");
      } catch (err: any) {
        toast.error(extractErrorMessage(err, "Failed to install plugin"));
      } finally {
        setActionInFlight(null);
      }
    },
    [installPlugin, providerId, installScope],
  );

  const handleUninstall = useCallback(
    async (pluginId: string) => {
      setActionInFlight(pluginId);
      try {
        await uninstallPlugin({ providerId, pluginId }).unwrap();
        toast.success("Plugin uninstalled");
      } catch (err: any) {
        toast.error(extractErrorMessage(err, "Failed to uninstall plugin"));
      } finally {
        setActionInFlight(null);
      }
    },
    [uninstallPlugin, providerId],
  );

  const handleToggleEnabled = useCallback(
    async (pluginId: string, enabled: boolean) => {
      setActionInFlight(pluginId);
      try {
        await setPluginEnabled({ providerId, pluginId, enabled }).unwrap();
        toast.success(enabled ? "Plugin enabled" : "Plugin disabled");
      } catch (err: any) {
        toast.error(extractErrorMessage(err, "Failed to update plugin"));
      } finally {
        setActionInFlight(null);
      }
    },
    [setPluginEnabled, providerId],
  );

  const handleUpdate = useCallback(
    async (pluginId: string) => {
      setActionInFlight(pluginId);
      try {
        await updatePlugin({ providerId, pluginId }).unwrap();
        toast.success("Plugin updated");
      } catch (err: any) {
        toast.error(extractErrorMessage(err, "Failed to update plugin"));
      } finally {
        setActionInFlight(null);
      }
    },
    [updatePlugin, providerId],
  );

  if (isLoading) {
    return (
      <div>
        <Muted>Loading plugins... This may take a moment on first load.</Muted>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Muted>Failed to load plugins: {extractErrorMessage(error, "Unknown error")}</Muted>
      </div>
    );
  }

  // Detail view
  if (selectedPlugin) {
    return (
      <PluginDetail
        plugin={selectedPlugin}
        providerId={providerId}
        marketplacePath={selectedPluginMarketplacePath}
        onBack={() => setSelectedPluginId(null)}
        onInstall={() => handleInstall(selectedPlugin.id)}
        onUninstall={() => handleUninstall(selectedPlugin.id)}
        onToggleEnabled={() => handleToggleEnabled(selectedPlugin.id, !selectedPlugin.enabled)}
        onUpdate={() => handleUpdate(selectedPlugin.id)}
        installScope={installScope}
        onScopeChange={setInstallScope}
        isInstalling={
          (isInstalling || isUninstalling) &&
          actionInFlight === selectedPlugin.id
        }
        isToggling={isToggling && actionInFlight === selectedPlugin.id}
        isUpdating={isUpdating && actionInFlight === selectedPlugin.id}
      />
    );
  }

  // List view
  return (
    <div className="mb-12">
      {/* Category filter + search */}
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex gap-1 min-w-0 flex-1 overflow-x-auto noscrollbar">
          <Button
            onClick={() => setCategoryFilter(null)}
            className={`shrink-0 whitespace-nowrap px-2.5 py-1 text-sm rounded-xl transition-colors cursor-pointer ${
              !categoryFilter
                ? "bg-primary-200/80 dark:bg-primary-800/60 text-primary-900 dark:text-primary-100"
                : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 hover:bg-primary-100/50 dark:hover:bg-primary-800/30"
            }`}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              onClick={() =>
                setCategoryFilter(cat === categoryFilter ? null : cat)
              }
              className={`shrink-0 whitespace-nowrap px-2.5 py-1 text-sm rounded-xl transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? "bg-primary-200/80 dark:bg-primary-800/60 text-primary-900 dark:text-primary-100"
                  : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 hover:bg-primary-100/50 dark:hover:bg-primary-800/30"
              }`}
            >
              {formatCategory(cat)}
            </Button>
          ))}
        </div>
        <div className="relative w-full md:w-56 md:shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-primary-400 dark:text-primary-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plugins..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 border border-primary-200/50 dark:border-primary-700/30 text-sm text-primary-900 dark:text-primary-100 placeholder:text-primary-400 dark:placeholder:text-primary-500 outline-none focus:ring-1 focus:ring-primary-300 dark:focus:ring-primary-600"
          />
        </div>
      </div>

      {/* Featured / Popular */}
      {highlight.length > 0 && !categoryFilter && (
        <div className="mb-6">
          <Body className=" font-medium mb-3">
            {highlightLabel}
          </Body>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8">
            {highlight.map((p) => (
              <PluginCard
                key={p.id}
                plugin={p}
                onSelect={() => setSelectedPluginId(p.id)}
                onInstall={() => handleInstall(p.id)}
                onUninstall={() => handleUninstall(p.id)}
                isInstalling={
                  (isInstalling || isUninstalling) && actionInFlight === p.id
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Grouped by category */}
      {grouped.map(([category, plugins]) => (
        <div key={category} className="mb-6">
          <Body className=" font-medium mb-3">
            {formatCategory(category)}
          </Body>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8">
            {plugins.map((p) => (
              <PluginCard
                key={p.id}
                plugin={p}
                onSelect={() => setSelectedPluginId(p.id)}
                onInstall={() => handleInstall(p.id)}
                onUninstall={() => handleUninstall(p.id)}
                isInstalling={
                  (isInstalling || isUninstalling) && actionInFlight === p.id
                }
              />
            ))}
          </div>
        </div>
      ))}

      {filteredPlugins.length === 0 && (
        <div className="text-center py-12">
          <Muted>No plugins found</Muted>
        </div>
      )}
    </div>
  );
}
