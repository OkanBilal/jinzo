import { useState, useMemo, useCallback } from "react";
import {
  Heading2,
  Heading3,
  Body,
  Muted,
  Button,
  toast,
} from "@/components/ui";
import {
  useListMarketplaceSkillsQuery,
  useSearchMarketplaceSkillsQuery,
  useGetCuratedSkillsQuery,
  useGetMarketplaceSkillDetailQuery,
} from "@/lib/redux/api";
import type {
  SkillSummary,
  SkillView,
} from "@/lib/redux/api";
import {
  Search,
  Clipboard,
  Check,
  ChevronDown,
  Sparkles,
  External,
} from "@/components/ui/icons";

// ── Helpers ──

function buildInstallCommand(installUrl?: string, fallbackId?: string): string {
  const target = installUrl || (fallbackId ? `https://skills.sh/${fallbackId}` : "");
  return target ? `npx skills add ${target}` : "";
}

function extractErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  const err = error as Record<string, unknown>;
  if (typeof err.message === "string") return err.message;
  if (typeof err.error === "string") return err.error;
  if (typeof err.data === "string") return err.data;
  return JSON.stringify(error);
}

function SkillLogo({
  skill,
  size = "md",
}: {
  skill: SkillSummary;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "size-14" : "size-8";
  const roundedClass = size === "lg" ? "rounded-2xl" : "rounded-lg";
  const textSize = size === "lg" ? "text-xl" : "text-sm";
  const ownerAvatar = skill.owner?.avatarUrl;
  const name = skill.name || skill.slug;

  if (ownerAvatar) {
    return (
      <img
        src={ownerAvatar}
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
      className={`${sizeClass} ${roundedClass} flex items-center justify-center font-semibold ${textSize} text-white shrink-0 bg-primary-500`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Skill Card ──

function SkillCard({
  skill,
  onSelect,
}: {
  skill: SkillSummary;
  onSelect: () => void;
}) {
  const name = skill.name || skill.slug;
  const description = skill.description || "";

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
      <SkillLogo skill={skill} size="md" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary-900 dark:text-primary-100 truncate mb-1">
          {name}
        </div>
        <div className="text-xs text-primary-500 dark:text-primary-400 truncate">
          {description}
        </div>
      </div>
      {typeof skill.installs === "number" && (
        <div className="shrink-0 text-xs text-primary-500 dark:text-primary-400 tabular-nums">
          {skill.installs.toLocaleString()} installs
        </div>
      )}
    </div>
  );
}

// ── Skill Detail ──

function SkillDetail({
  skill,
  onBack,
}: {
  skill: SkillSummary;
  onBack: () => void;
}) {
  const name = skill.name || skill.slug;
  const installCmd = buildInstallCommand(skill.installUrl, skill.id);

  const { data: detail, isLoading: detailLoading } =
    useGetMarketplaceSkillDetailQuery(
      { source: skill.source, skill: skill.slug },
      { skip: !skill.source || !skill.slug },
    );

  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    if (!installCmd) return;
    navigator.clipboard.writeText(installCmd).then(() => {
      setCopied(true);
      toast.success("Install command copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }, [installCmd]);

  const homepage = detail?.homepage || skill.homepage;
  const readme = detail?.readme;
  const description = detail?.description || skill.description;
  const files = detail?.files ?? [];

  return (
    <div>
      <Button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-primary-500 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-100 mb-6 cursor-pointer"
      >
        <ChevronDown className="size-4 rotate-90" />
        Back to skills
      </Button>

      <div className="flex items-start gap-4 mb-6">
        <SkillLogo skill={skill} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <Heading2>{name}</Heading2>
            <Button
              onClick={handleCopy}
              variant="primary"
              size="sm"
              disabled={!installCmd}
            >
              {copied ? (
                <span className="flex items-center gap-1.5">
                  <Check className="size-4" />
                  Copied
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Clipboard className="size-4" />
                  Copy install command
                </span>
              )}
            </Button>
          </div>
          {description && <Muted className="mt-1">{description}</Muted>}
        </div>
      </div>

      {installCmd && (
        <div className="mb-8 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 px-4 py-3 flex items-center gap-3">
          <code className="flex-1 text-sm font-mono text-primary-800 dark:text-primary-200 truncate">
            {installCmd}
          </code>
          <Button
            type="button"
            onClick={handleCopy}
            className="shrink-0 text-primary-400 dark:text-primary-500 hover:text-primary-700 dark:hover:text-primary-200 cursor-pointer"
            tooltip={copied ? "Copied!" : "Copy"}
          >
            {copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
          </Button>
        </div>
      )}

      {readme && (
        <div className="mb-8">
          <Heading3 className="mb-3">Readme</Heading3>
          <Body className="text-primary-700 dark:text-primary-300 whitespace-pre-wrap">
            {readme}
          </Body>
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-8">
          <Heading3 className="mb-3">Files</Heading3>
          <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/20 divide-y divide-primary-200/60 dark:divide-primary-800/20">
            {files.map((f) => (
              <div key={f.path} className="flex items-center gap-3 px-4 py-2.5">
                <Sparkles className="size-4 text-primary-500 dark:text-primary-400 shrink-0" />
                <div className="flex-1 min-w-0 text-sm text-primary-800 dark:text-primary-200 font-mono truncate">
                  {f.path}
                </div>
                {typeof f.size === "number" && (
                  <span className="shrink-0 text-xs text-primary-500 dark:text-primary-400 tabular-nums">
                    {f.size.toLocaleString()} B
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {skill.tags && skill.tags.length > 0 && (
        <div className="mb-8">
          <Heading3 className="mb-3">Tags</Heading3>
          <div className="flex flex-wrap gap-2">
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs font-medium bg-primary-200/50 dark:bg-primary-700/30 text-primary-700 dark:text-primary-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <Heading3 className="mb-3">Information</Heading3>
      <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/20 divide-y divide-primary-200/60 dark:divide-primary-800/20">
        <InfoRow label="Source" value={skill.source} />
        <InfoRow label="Slug" value={skill.slug} />
        {skill.owner?.name && <InfoRow label="Owner" value={skill.owner.name} />}
        {typeof skill.installs === "number" && (
          <InfoRow label="Installs" value={skill.installs.toLocaleString()} />
        )}
        {homepage && (
          <InfoRow
            label="Homepage"
            value={
              <a
                href={homepage}
                onClick={(e) => {
                  e.preventDefault();
                  window.api.shell.openExternal(homepage);
                }}
                className="text-blue-500 hover:underline flex items-center gap-1"
              >
                {(() => {
                  try {
                    return new URL(homepage).hostname;
                  } catch {
                    return homepage;
                  }
                })()}
                <External className="size-3" />
              </a>
            }
          />
        )}
        <InfoRow
          label="View on skills.sh"
          value={
            <a
              href={`https://skills.sh/${skill.id}`}
              onClick={(e) => {
                e.preventDefault();
                window.api.shell.openExternal(`https://skills.sh/${skill.id}`);
              }}
              className="text-blue-500 hover:underline flex items-center gap-1"
            >
              skills.sh/{skill.id}
              <External className="size-3" />
            </a>
          }
        />
      </div>

      {detailLoading && !detail && (
        <Muted className="mt-6">Loading details…</Muted>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
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

// ── Main Component ──

const VIEWS: { value: SkillView | "curated"; label: string }[] = [
  { value: "curated", label: "Curated" },
  { value: "trending", label: "Trending" },
  { value: "hot", label: "Hot" },
  { value: "all-time", label: "All-time" },
];

export default function SkillsMarketplace() {
  const [activeView, setActiveView] = useState<SkillView | "curated">("curated");
  const [search, setSearch] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const trimmedQuery = search.trim();
  const isSearching = trimmedQuery.length >= 2;

  const curatedQuery = useGetCuratedSkillsQuery(undefined, {
    skip: activeView !== "curated" || isSearching,
  });
  const listQuery = useListMarketplaceSkillsQuery(
    activeView !== "curated" ? { view: activeView, perPage: 30 } : undefined,
    { skip: activeView === "curated" || isSearching },
  );
  const searchQuery = useSearchMarketplaceSkillsQuery(
    { q: trimmedQuery, limit: 30 },
    { skip: !isSearching },
  );

  const isLoading = isSearching
    ? searchQuery.isLoading
    : activeView === "curated"
      ? curatedQuery.isLoading
      : listQuery.isLoading;
  const error = isSearching
    ? searchQuery.error
    : activeView === "curated"
      ? curatedQuery.error
      : listQuery.error;

  const allVisibleSkills = useMemo<SkillSummary[]>(() => {
    if (isSearching) return searchQuery.data?.results ?? [];
    if (activeView === "curated") {
      return (curatedQuery.data?.groups ?? []).flatMap((g) => [
        ...(g.featured ?? []),
        ...g.skills,
      ]);
    }
    return listQuery.data?.skills ?? [];
  }, [isSearching, searchQuery.data, activeView, curatedQuery.data, listQuery.data]);

  const selectedSkill = useMemo(
    () => allVisibleSkills.find((s) => s.id === selectedSkillId) ?? null,
    [allVisibleSkills, selectedSkillId],
  );

  if (selectedSkill) {
    return <SkillDetail skill={selectedSkill} onBack={() => setSelectedSkillId(null)} />;
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              onClick={() => setActiveView(v.value)}
              className={`px-2.5 py-1 text-sm rounded-xl transition-colors cursor-pointer ${
                activeView === v.value && !isSearching
                  ? "bg-primary-200/80 dark:bg-primary-800/60 text-primary-900 dark:text-primary-100"
                  : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 hover:bg-primary-100/50 dark:hover:bg-primary-800/30"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-primary-400 dark:text-primary-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-primary-100/50 dark:bg-primary-800/30 border border-primary-200/50 dark:border-primary-700/30 text-sm text-primary-900 dark:text-primary-100 placeholder:text-primary-400 dark:placeholder:text-primary-500 outline-none focus:ring-1 focus:ring-primary-300 dark:focus:ring-primary-600"
          />
        </div>
      </div>

      {isLoading && <Muted>Loading skills from skills.sh…</Muted>}

      {error && !isLoading && (
        <div className="rounded-2xl glass-morphism px-5 py-5">
          <div className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-2">
            Skills cannot be listed right now
          </div>
          <Muted className="block mb-3">
            The skills.sh API is currently rejecting public requests due to a
            bug on their side, so the marketplace browser is unavailable. Once
            it&rsquo;s fixed this tab will start working with no changes here.
          </Muted>
          <Muted className="block mb-3">
            In the meantime you can still add skills manually — at the project
            scope (inside a workspace) or at the global scope (user-wide) — via
            the official CLI:
          </Muted>
          <div className="rounded-xl bg-primary-100/50 dark:bg-primary-800/30 px-4 py-2.5 mb-4">
            <code className="text-sm font-mono text-primary-800 dark:text-primary-200">
              npx skills add &lt;owner/repo&gt;
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <a
              href="https://github.com/vercel-labs/skills"
              onClick={(e) => {
                e.preventDefault();
                window.api.shell.openExternal(
                  "https://github.com/vercel-labs/skills",
                );
              }}
              className="text-sm text-blue-500 hover:underline inline-flex items-center gap-1"
            >
              github.com/vercel-labs/skills
              <External className="size-3" />
            </a>
            <a
              href="https://skills.sh/"
              onClick={(e) => {
                e.preventDefault();
                window.api.shell.openExternal("https://skills.sh/");
              }}
              className="text-sm text-blue-500 hover:underline inline-flex items-center gap-1"
            >
              skills.sh
              <External className="size-3" />
            </a>
          </div>
          <details className="text-xs text-primary-500 dark:text-primary-400">
            <summary className="cursor-pointer">Error details</summary>
            <div className="mt-2 font-mono break-all">
              {extractErrorMessage(error)}
            </div>
          </details>
        </div>
      )}

      {/* Search results */}
      {!error && !isLoading && isSearching && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-3">
            Results for &ldquo;{trimmedQuery}&rdquo;
          </h3>
          {(searchQuery.data?.results ?? []).length === 0 ? (
            <div className="text-center py-12">
              <Muted>No skills found</Muted>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-8">
              {searchQuery.data!.results.map((s) => (
                <SkillCard
                  key={s.id}
                  skill={s}
                  onSelect={() => setSelectedSkillId(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Curated groups */}
      {!error && !isLoading && !isSearching && activeView === "curated" && (
        <>
          {(curatedQuery.data?.groups ?? []).map((group) => {
            const items = [...(group.featured ?? []), ...group.skills];
            if (items.length === 0) return null;
            return (
              <div key={group.owner.name} className="mb-6">
                <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-3">
                  {group.owner.name}
                </h3>
                <div className="grid grid-cols-2 gap-8">
                  {items.map((s) => (
                    <SkillCard
                      key={s.id}
                      skill={s}
                      onSelect={() => setSelectedSkillId(s.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {(curatedQuery.data?.groups ?? []).length === 0 && (
            <div className="text-center py-12">
              <Muted>No curated skills available</Muted>
            </div>
          )}
        </>
      )}

      {/* Leaderboard list */}
      {!error && !isLoading && !isSearching && activeView !== "curated" && (
        <div className="mb-6">
          {(listQuery.data?.skills ?? []).length === 0 ? (
            <div className="text-center py-12">
              <Muted>No skills found</Muted>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-8">
              {listQuery.data!.skills.map((s) => (
                <SkillCard
                  key={s.id}
                  skill={s}
                  onSelect={() => setSelectedSkillId(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
