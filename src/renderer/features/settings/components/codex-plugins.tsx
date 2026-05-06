import { useState, useMemo, useCallback } from "react";
import {
  Heading2,
  Heading3,
  Body,
  Muted,
  Button,
  toast,
  AsciiSpinner,
} from "@/components/ui";
import {
  useGetProviderPluginsQuery,
  useReadProviderPluginQuery,
  useInstallProviderPluginMutation,
  useUninstallProviderPluginMutation,
} from "@/lib/redux/api";
import type { PluginInfo } from "@/lib/redux/api";
import {
  Search,
  Clipboard,
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

function PluginLogo({
  plugin,
  size = "md",
}: {
  plugin: PluginInfo;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "size-14" : size === "md" ? "size-8" : "size-8";
  const roundedClass = size === "lg" ? "rounded-2xl" : "rounded-lg";
  const textSize =
    size === "lg" ? "text-xl" : size === "md" ? "text-sm" : "text-xs";
  const brandColor = plugin.interface?.brandColor;
  const logo = plugin.interface?.logo;
  const name = plugin.interface?.displayName || plugin.name;

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
      className={`${sizeClass} ${roundedClass} flex items-center justify-center font-semibold ${textSize} text-white shrink-0`}
      style={{ backgroundColor: brandColor || "var(--color-primary-500)" }}
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
  const name = plugin.interface?.displayName || plugin.name;
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
        <div className="text-sm font-medium text-primary-900 dark:text-primary-100 truncate mb-1">
          {name}
        </div>
        <div className="text-xs text-primary-500 dark:text-primary-400 truncate">
          {description}
        </div>
      </div>
      <Button
        type="button"
        className={`shrink-0 size-8 flex items-center justify-center rounded-full text-lg transition-colors cursor-pointer ${
          plugin.installed
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
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
  marketplacePath,
  onBack,
  onInstall,
  onUninstall,
  isInstalling,
}: {
  plugin: PluginInfo;
  marketplacePath: string;
  onBack: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  isInstalling: boolean;
}) {
  const iface = plugin.interface;
  const name = iface?.displayName || plugin.name;
  const pluginName = plugin.name || plugin.id.split("@")[0];

  const { data: detail } = useReadProviderPluginQuery(
    { providerId: "codex", pluginName, marketplacePath },
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
            <Button
              onClick={plugin.installed ? onUninstall : onInstall}
              disabled={
                isInstalling || plugin.installPolicy === "NOT_AVAILABLE"
              }
              variant={plugin.installed ? "secondary" : "primary"}
              size="sm"
              className=""
            >
              {isInstalling ? (
                <div className=" px-1.5">
                  <AsciiSpinner variant="null" />
                </div>
              ) : plugin.installed ? (
                "Uninstall"
              ) : (
                "Add"
              )}
            </Button>
          </div>
          {iface?.shortDescription && (
            <Muted className="mt-1">{iface.shortDescription}</Muted>
          )}
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
          <Body className="text-primary-700 dark:text-primary-300 whitespace-pre-wrap">
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
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    Connected
                  </span>
                ) : app.installUrl ? (
                  <Button
                    size="sm"
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
                className="text-blue-500 hover:underline"
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
                className="text-blue-500 hover:underline"
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
                className="text-blue-500 hover:underline"
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
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [prompt]);

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 group">
      <span className="flex-1 text-sm text-primary-700 dark:text-primary-300">
        {prompt}
      </span>
      <Button
        type="button"
        onClick={handleCopy}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-primary-400 dark:text-primary-500 hover:text-primary-700 dark:hover:text-primary-200"
        tooltip={copied ? "Copied!" : "Copy"}
      >
        {copied ? (
          <Check className="size-4" />
        ) : (
          <Clipboard className="size-4" />
        )}
      </Button>
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
];

// ── Main Component ──

export default function CodexPlugins() {
  const {
    data: pluginData,
    isLoading,
    error,
  } = useGetProviderPluginsQuery("codex");
  const [installPlugin, { isLoading: isInstalling }] =
    useInstallProviderPluginMutation();
  const [uninstallPlugin, { isLoading: isUninstalling }] =
    useUninstallProviderPluginMutation();

  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

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

  // Group by category
  const featured = useMemo(
    () => filteredPlugins.filter((p) => featuredIds.has(p.id)),
    [filteredPlugins, featuredIds],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, PluginInfo[]>();
    for (const p of filteredPlugins) {
      if (featuredIds.has(p.id) && !categoryFilter) continue;
      const cat = p.interface?.category || "Other";
      const list = groups.get(cat) ?? [];
      list.push(p);
      groups.set(cat, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPlugins, featuredIds, categoryFilter]);

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
        await installPlugin({ providerId: "codex", pluginId }).unwrap();
        toast.success("Plugin installed");
      } catch (err: any) {
        toast.error(err?.message || "Failed to install plugin");
      } finally {
        setActionInFlight(null);
      }
    },
    [installPlugin],
  );

  const handleUninstall = useCallback(
    async (pluginId: string) => {
      setActionInFlight(pluginId);
      try {
        await uninstallPlugin({ providerId: "codex", pluginId }).unwrap();
        toast.success("Plugin uninstalled");
      } catch (err: any) {
        toast.error(err?.message || "Failed to uninstall plugin");
      } finally {
        setActionInFlight(null);
      }
    },
    [uninstallPlugin],
  );

  if (isLoading) {
    return (
      <div>
        <Muted>Loading plugins... This may take a moment on first load.</Muted>
      </div>
    );
  }

  if (error) {
    const errMsg =
      "message" in (error as any)
        ? (error as any).message
        : "error" in (error as any)
          ? String((error as any).error)
          : "data" in (error as any)
            ? String((error as any).data)
            : "Unknown error";
    return (
      <div>
        <Muted>Failed to load plugins: {errMsg}</Muted>
      </div>
    );
  }

  // Detail view
  if (selectedPlugin) {
    return (
      <PluginDetail
        plugin={selectedPlugin}
        marketplacePath={selectedPluginMarketplacePath}
        onBack={() => setSelectedPluginId(null)}
        onInstall={() => handleInstall(selectedPlugin.id)}
        onUninstall={() => handleUninstall(selectedPlugin.id)}
        isInstalling={
          (isInstalling || isUninstalling) &&
          actionInFlight === selectedPlugin.id
        }
      />
    );
  }

  // List view
  return (
    <div className="mb-12">
      {/* Category filter + search */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex gap-1">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`px-2.5 py-1 text-sm rounded-xl transition-colors cursor-pointer ${
              !categoryFilter
                ? "bg-primary-200/80 dark:bg-primary-800/60 text-primary-900 dark:text-primary-100"
                : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 hover:bg-primary-100/50 dark:hover:bg-primary-800/30"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setCategoryFilter(cat === categoryFilter ? null : cat)
              }
              className={`px-2.5 py-1 text-sm rounded-xl transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? "bg-primary-200/80 dark:bg-primary-800/60 text-primary-900 dark:text-primary-100"
                  : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 hover:bg-primary-100/50 dark:hover:bg-primary-800/30"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative w-56">
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

      {/* Featured */}
      {featured.length > 0 && !categoryFilter && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-3">
            Featured
          </h3>
          <div className="grid grid-cols-2 gap-8">
            {featured.map((p) => (
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
          <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-3">
            {category}
          </h3>
          <div className="grid grid-cols-2 gap-8">
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
