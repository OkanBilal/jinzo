import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetPrAvailabilityQuery,
  useGetSelectedResourcesQuery,
  useSearchPullRequestsQuery,
  useLazySearchPullRequestsQuery,
  type PrLifecycle,
  type PrRelationship,
  type PrSearchPage,
  type PullRequestSummary,
} from "@/lib/redux/api";
import {
  Button,
  DropdownWrapper,
  Input,
  SegmentedTabs,
} from "@/components/ui";
import { Close, Layers, Search } from "@/components/ui/icons";
import { Body } from "@/components/ui/text";
import { useClickOutside } from "@/hooks/use-click-outside";
import {
  FilterChoiceSection,
  FilterSection,
  sortedEntries,
} from "./filter-section";
import { PrListItem } from "./pr-list-item";

const PAGE_SIZE = 30;

const RELATIONSHIP_FILTERS: { value: PrRelationship; label: string }[] = [
  { value: "all", label: "All" },
  { value: "review_requested", label: "Review requested" },
  { value: "reviewed", label: "Reviewed" },
  { value: "authored", label: "Authored" },
];

const LIFECYCLE_FILTERS: { value: PrLifecycle; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "merged", label: "Merged" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "Any state" },
];

interface PullRequestsPanelProps {
  selectedNodeId: string | null;
  onSelectPr: (pr: PullRequestSummary) => void;
}

export function PullRequestsPanel({
  selectedNodeId,
  onSelectPr,
}: PullRequestsPanelProps) {
  const navigate = useNavigate();
  const [relationship, setRelationship] = useState<PrRelationship>("all");
  const [lifecycle, setLifecycle] = useState<PrLifecycle>("open");
  const [text, setText] = useState("");
  const [debouncedText, setDebouncedText] = useState("");
  // Pages loaded past the first via "Load more", keyed by the filters they
  // belong to — a filters change makes the stored pages irrelevant without
  // needing a reset effect.
  const [extra, setExtra] = useState<{ key: string; pages: PrSearchPage[] }>({
    key: "",
    pages: [],
  });
  const [repoFilters, setRepoFilters] = useState<string[]>([]);
  const [repoFilterOpen, setRepoFilterOpen] = useState(false);
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(repoDropdownRef, () => {
    if (repoFilterOpen) setRepoFilterOpen(false);
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const { data: availability, isLoading: availabilityLoading } =
    useGetPrAvailabilityQuery(undefined);

  const filters = useMemo(
    () => ({
      relationship,
      lifecycle,
      text: debouncedText || undefined,
      ...(repoFilters.length > 0
        ? { repos: [...repoFilters].sort() }
        : {}),
      pageSize: PAGE_SIZE,
    }),
    [relationship, lifecycle, debouncedText, repoFilters],
  );

  const connected = availability?.connected === true && !availability.error;

  // currentData (not data): on a filter/tab change RTK's `data` keeps serving
  // the previous query's rows until the new one lands — the list must drop to
  // the loading state instead of silently showing stale results.
  const {
    currentData: firstPage,
    isFetching,
    isError,
    refetch,
  } = useSearchPullRequestsQuery(filters, {
    skip: !connected,
    refetchOnMountOrArgChange: 30,
  });

  const [loadMore, { isFetching: isFetchingMore }] =
    useLazySearchPullRequestsQuery();

  const filtersKey = JSON.stringify(filters);
  const extraPages = useMemo(
    () => (extra.key === filtersKey ? extra.pages : []),
    [extra, filtersKey],
  );

  const items = useMemo(() => {
    const seen = new Set<string>();
    const merged: PullRequestSummary[] = [];
    for (const page of [firstPage, ...extraPages]) {
      for (const item of page?.items ?? []) {
        if (seen.has(item.nodeId)) continue;
        seen.add(item.nodeId);
        merged.push(item);
      }
    }
    return merged;
  }, [firstPage, extraPages]);

  const lastPage = extraPages.length
    ? extraPages[extraPages.length - 1]
    : firstPage;
  const hasNextPage = lastPage?.hasNextPage === true && lastPage.endCursor;

  // Facet options are the repos selected on the GitHub connection — the same
  // set the search is scoped to by default — plus anything present in the
  // loaded rows (covers the no-selection global fallback).
  const { data: selectedResources } = useGetSelectedResourcesQuery("github");

  const repoOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const resource of selectedResources?.items ?? []) {
      const slug = resource?.externalId;
      if (typeof slug === "string" && slug.includes("/")) counts.set(slug, 0);
    }
    for (const pr of items) {
      const slug = `${pr.repo.owner}/${pr.repo.repo}`;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    for (const slug of repoFilters) {
      if (!counts.has(slug)) counts.set(slug, 0);
    }
    return sortedEntries(counts);
  }, [selectedResources, items, repoFilters]);

  const toggleRepoFilter = (slug: string) =>
    setRepoFilters((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : [...prev, slug],
    );

  // A non-default state counts as a filter too, now that it lives inside
  // the facet menu with no always-visible control of its own.
  const activeFilterCount =
    repoFilters.length + (lifecycle !== "open" ? 1 : 0);

  const clearFilters = () => {
    setRepoFilters([]);
    setLifecycle("open");
  };

  // The detail drawer is always open — keep it pointed at the top row
  // whenever nothing (or something no longer listed) is selected.
  useEffect(() => {
    if (items.length === 0) return;
    if (selectedNodeId && items.some((pr) => pr.nodeId === selectedNodeId)) {
      return;
    }
    onSelectPr(items[0]);
  }, [items, selectedNodeId, onSelectPr]);

  const handleLoadMore = async () => {
    if (!lastPage?.endCursor) return;
    const result = await loadMore(
      { ...filters, cursor: lastPage.endCursor },
      true,
    ).unwrap();
    setExtra((prev) => ({
      key: filtersKey,
      pages: prev.key === filtersKey ? [...prev.pages, result] : [result],
    }));
  };

  if (availabilityLoading) {
    return (
      <div className="flex items-center justify-center py-16 px-6">
        <span className="text-xs shine-text">Checking GitHub access...</span>
      </div>
    );
  }

  if (!availability?.connected || availability.error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
        <Body className="text-s text-primary-900 dark:text-primary-100 font-medium">
          {availability?.error ?? "GitHub is not connected"}
        </Body>
        {!availability?.error && (
          <Body className="text-xs text-primary-700 dark:text-primary-400 max-w-90">
            Connect GitHub to see pull requests you authored, are reviewing, or
            were asked to review.
          </Body>
        )}
        <Button
          variant="primary"
          onClick={() => navigate("/settings?section=connections")}
        >
          Open Connections
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search + filters — stay put while the list scrolls */}
      <div className="shrink-0 px-6 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-primary-400" />
          <Input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search pull requests"
            aria-label="Search pull requests"
            className={`w-full pl-9 ${text ? "pr-9" : "pr-3"} py-1.5 text-s rounded-2xl bg-primary/40 dark:bg-primary/5 glass-outline placeholder:text-primary-600 dark:placeholder:text-primary-500 text-primary-900 dark:text-primary-100 outline-none`}
          />
          {text && (
            <Button
              onClick={() => setText("")}
              tooltip="Clear search"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 p-1 rounded-lg cursor-pointer text-primary-500 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 hover:bg-primary/50 dark:hover:bg-primary/10"
            >
              <Close className="size-3" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <SegmentedTabs
            variant="plain"
            value={relationship}
            onChange={setRelationship}
            options={RELATIONSHIP_FILTERS}
            className="w-fit"
          />
          <div className="flex items-center gap-1.5">
            {activeFilterCount > 0 && (
              <Button
                onClick={clearFilters}
                className="px-2 py-0.5 text-xxs rounded-full bg-primary/60 dark:bg-primary/10 glass-outline text-primary-800 dark:text-primary-200 cursor-pointer whitespace-nowrap"
                tooltip="Clear filters"
              >
                {activeFilterCount} filter
                {activeFilterCount === 1 ? "" : "s"}
              </Button>
            )}
            {/* State + repository facet menu, anchored under the button. */}
            <div className="relative" ref={repoDropdownRef}>
              <Button
                onClick={() => setRepoFilterOpen((open) => !open)}
                tooltip="Filter pull requests"
                aria-label="Filter pull requests"
                aria-expanded={repoFilterOpen}
                className={`p-1.5 rounded-xl cursor-pointer transition-colors ${
                  repoFilterOpen || activeFilterCount > 0
                    ? "bg-primary/80 dark:bg-primary/10 glass-outline text-primary-900 dark:text-primary-100"
                    : "text-primary-500 dark:text-primary-400 hover:bg-primary/50 dark:hover:bg-primary/10 hover:text-primary-800 dark:hover:text-primary-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
              </Button>
              <DropdownWrapper
                isOpen={repoFilterOpen}
                minWidth="min-w-80"
                position="right"
              >
                <div className="max-h-80 overflow-y-auto noscrollbar pb-1.5">
                  <FilterChoiceSection
                    title="State"
                    options={LIFECYCLE_FILTERS}
                    value={lifecycle}
                    onSelect={setLifecycle}
                  />
                  <FilterSection
                    title="Repository"
                    entries={repoOptions}
                    selected={repoFilters}
                    onToggle={toggleRepoFilter}
                  />
                  {activeFilterCount > 0 && (
                    <div className="px-3 pt-2">
                      <Button
                        variant="subtle"
                        onClick={clearFilters}
                        className="w-full text-center text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 cursor-pointer py-1"
                      >
                        Clear filters
                      </Button>
                    </div>
                  )}
                </div>
              </DropdownWrapper>
            </div>
          </div>
        </div>
      </div>

      {/* Scrolling list — rows fade out as they slide under the controls */}
      <div className="flex-1 min-h-0 overflow-y-auto noscrollbar px-6 pt-3 pb-16 mask-[linear-gradient(to_bottom,transparent,black_1.75rem)]">
        {isError ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <Body className="text-xs text-primary-800 dark:text-primary-300">
              Unable to load pull requests.
            </Body>
            <Button variant="subtle" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : isFetching && items.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-xs shine-text">Loading pull requests...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Body className="text-xs text-primary-800 dark:text-primary-300">
              No pull requests match these filters.
            </Body>
          </div>
        ) : (
          <div className="space-y-2 min-w-0">
            {items.map((pr, index) => (
              <div
                key={pr.nodeId}
                className="animate-slide-in"
                style={{ animationDelay: `${Math.min(index, 20) * 0.02}s` }}
              >
                <PrListItem
                  pr={pr}
                  isActive={selectedNodeId === pr.nodeId}
                  compact
                  onClick={() => onSelectPr(pr)}
                />
              </div>
            ))}
            {hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="subtle"
                  disabled={isFetchingMore}
                  onClick={handleLoadMore}
                >
                  {isFetchingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
