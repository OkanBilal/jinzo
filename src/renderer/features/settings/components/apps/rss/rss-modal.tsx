"use client";

import { useState, useEffect, useCallback } from "react";

import { BodyMedium, Caption, Muted, ErrorText } from "../../../../../components/ui/text";
import { ConnectionModalWrapper, LoadingState } from "../shared";
import {
  GhostButton,
  PrimaryButton,
  WarningButton,
  DangerButton,
} from "../../../../../components/ui/button";
import {
  useLazyGetRssStatusQuery,
  useUpdateRssSettingsMutation,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
  RssFeed,
} from "../../../../../lib/redux/api";

interface RssModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "enable" | "add" | "manage";

export default function RssModal({ open, onClose }: RssModalProps) {
  const [step, setStep] = useState<Step>("enable");
  const [enabled, setEnabled] = useState(false);
  const [connectionId, setConnectionId] = useState("");
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedsToAdd, setFeedsToAdd] = useState<
    Array<{ name: string; url: string }>
  >([]);
  const [currentFeeds, setCurrentFeeds] = useState<RssFeed[]>([]);
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);

  const [getRssStatus] = useLazyGetRssStatusQuery();
  const [updateSettings, { isLoading: isUpdating }] =
    useUpdateRssSettingsMutation();
  const [saveResources, { isLoading: isSaving }] = useSaveResourcesMutation();
  const [deleteResource, { isLoading: isDeleting }] =
    useDeleteResourceMutation();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  const loading = isUpdating || isSaving || isDeleting || isRevoking;

  const loadCurrentSettings = useCallback(async () => {
    try {
      const result = await getRssStatus().unwrap();

      if (result.success) {
        const isEnabled = result.enabled;
        setEnabled(isEnabled);
        setConnectionId(result.connectionId || "");
        setCurrentFeeds(result.feeds || []);
        setStep(isEnabled ? "manage" : "enable");
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to load settings");
    }
  }, [getRssStatus]);

  useEffect(() => {
    if (open) {
      const startTime = Date.now();

      const loadData = async () => {
        setInitializing(true);
        await loadCurrentSettings();

        const elapsed = Date.now() - startTime;
        const minLoadingTime = 600;
        const remainingTime = Math.max(0, minLoadingTime - elapsed);

        setTimeout(() => {
          setInitializing(false);
        }, remainingTime);
      };

      loadData();
    }
  }, [open, loadCurrentSettings]);

  if (!open) return null;

  const handleClose = () => {
    setConnectionId("");
    setFeedName("");
    setFeedUrl("");
    setFeedsToAdd([]);
    setCurrentFeeds([]);
    setError("");
    setStep("enable");
    setInitializing(false);
    onClose();
  };

  const handleEnableContinue = async () => {
    setError("");

    if (enabled) {
      try {
        const enableResult = await updateSettings({ enabled: true }).unwrap();
        const newConnectionId = enableResult.connectionId || "";

        if (!newConnectionId) {
          throw new Error("No connection ID returned from server");
        }

        setConnectionId(newConnectionId);
        setStep("add");
      } catch (err: any) {
        setError(err?.data?.error || err?.message || "An error occurred");
      }
    } else {
      try {
        await updateSettings({ enabled: false }).unwrap();
        handleClose();
      } catch (err: any) {
        setError(err?.data?.error || err?.message || "An error occurred");
      }
    }
  };

  const handleAddFeed = () => {
    if (!feedName.trim() || !feedUrl.trim()) {
      setError("Please enter both name and URL");
      return;
    }

    try {
      new URL(feedUrl.trim());
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    if (feedsToAdd.some((f) => f.url === feedUrl.trim())) {
      setError("This feed URL is already in the list");
      return;
    }

    setFeedsToAdd([
      ...feedsToAdd,
      { name: feedName.trim(), url: feedUrl.trim() },
    ]);
    setFeedName("");
    setFeedUrl("");
    setError("");
  };

  const handleRemoveFeedFromList = (url: string) => {
    setFeedsToAdd(feedsToAdd.filter((f) => f.url !== url));
  };

  const handleSaveFeeds = async () => {
    if (feedsToAdd.length === 0) {
      setError("Please add at least one RSS feed");
      return;
    }

    setError("");

    try {
      const actualConnectionId = connectionId;

      if (!actualConnectionId) {
        throw new Error("Failed to create RSS connection");
      }

      const feeds = feedsToAdd.map((feed) => ({
        name: feed.name,
        url: feed.url,
      }));

      await saveResources({
        provider: "rss",
        connectionId: actualConnectionId,
        resources: feeds,
      }).unwrap();

      setFeedsToAdd([]);
      await loadCurrentSettings();
      setStep("manage");
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleRemoveFeed = async (feedId: string) => {
    setError("");

    try {
      await deleteResource(feedId).unwrap();
      await loadCurrentSettings();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleRevokeConnection = async () => {
    if (!confirm("Are you sure you want to disconnect all RSS feeds?")) {
      return;
    }

    setError("");

    try {
      await revokeConnection("rss").unwrap();
      handleClose();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleAddNewFeeds = () => {
    setStep("add");
  };

  return (
    <ConnectionModalWrapper
      open={open}
      onClose={handleClose}
      appName="RSS Connection"
      appIcon="/apps/rss-skeuomorphic.png"
    >
      {initializing ? (
        <LoadingState message="Loading RSS feeds..." />
      ) : step === "enable" ? (
        <EnableStep
          enabled={enabled}
          onEnabledChange={setEnabled}
          onContinue={handleEnableContinue}
          loading={loading}
          error={error}
        />
      ) : step === "add" ? (
        <AddFeedsStep
          feedName={feedName}
          feedUrl={feedUrl}
          feedsToAdd={feedsToAdd}
          onFeedNameChange={setFeedName}
          onFeedUrlChange={setFeedUrl}
          onAddFeed={handleAddFeed}
          onRemoveFeed={handleRemoveFeedFromList}
          onSave={handleSaveFeeds}
          onBack={() => setStep(enabled ? "manage" : "enable")}
          loading={loading}
          error={error}
        />
      ) : (
        <ManageFeedsStep
          feeds={currentFeeds}
          onAddNew={handleAddNewFeeds}
          onRemove={handleRemoveFeed}
          onRevoke={handleRevokeConnection}
          loading={loading}
          error={error}
        />
      )}
    </ConnectionModalWrapper>
  );
}

interface EnableStepProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onContinue: () => void;
  loading: boolean;
  error: string;
}

function EnableStep({
  enabled,
  onEnabledChange,
  onContinue,
  loading,
  error,
}: EnableStepProps) {
  return (
    <div className="space-y-4">
      <Muted>Enable RSS to add custom RSS feeds to your feed.</Muted>

      <div className="flex items-center justify-between p-4 bg-primary-100 dark:bg-primary-800 rounded-xl">
        <BodyMedium>Enable RSS</BodyMedium>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="sr-only peer"
            disabled={loading}
          />
          <div className="w-11 h-6 bg-primary-300 dark:bg-primary-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:border-primary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-900 dark:peer-checked:bg-primary-300"></div>
        </label>
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex justify-end gap-3 pt-2">
        <PrimaryButton
          onClick={onContinue}
          disabled={loading}
          isLoading={loading}
        >
          {enabled ? "Add Feeds" : "Save"}
        </PrimaryButton>
      </div>
    </div>
  );
}

interface AddFeedsStepProps {
  feedName: string;
  feedUrl: string;
  feedsToAdd: Array<{ name: string; url: string }>;
  onFeedNameChange: (value: string) => void;
  onFeedUrlChange: (value: string) => void;
  onAddFeed: () => void;
  onRemoveFeed: (url: string) => void;
  onSave: () => void;
  onBack: () => void;
  loading: boolean;
  error: string;
}

function AddFeedsStep({
  feedName,
  feedUrl,
  feedsToAdd,
  onFeedNameChange,
  onFeedUrlChange,
  onAddFeed,
  onRemoveFeed,
  onSave,
  onBack,
  loading,
  error,
}: AddFeedsStepProps) {
  return (
    <div className="space-y-4">
      <Muted>
        Add RSS feeds you want to follow. {feedsToAdd.length} added.
      </Muted>

      <div className="space-y-3">
        <div>
          <label htmlFor="rss-feed-name" className="block mb-2">
            <BodyMedium>Feed Name</BodyMedium>
          </label>
          <input
            id="rss-feed-name"
            type="text"
            value={feedName}
            onChange={(e) => onFeedNameChange(e.target.value)}
            placeholder="e.g., Tech Blog, News Feed"
            className="w-full px-3 py-2.5 bg-white dark:bg-primary-100 rounded-xl text-primary-900 dark:text-primary-900 placeholder:text-primary-400 dark:placeholder:text-primary-600 focus:outline-none"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="rss-feed-url" className="block mb-2">
            <BodyMedium>Feed URL</BodyMedium>
          </label>
          <div className="flex gap-2">
            <input
              id="rss-feed-url"
              type="url"
              value={feedUrl}
              onChange={(e) => onFeedUrlChange(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="flex-1 px-3 py-2.5 bg-white dark:bg-primary-100 rounded-xl text-primary-900 dark:text-primary-900 placeholder:text-primary-400 dark:placeholder:text-primary-600 focus:outline-none"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddFeed();
              }}
            />
            <PrimaryButton
              onClick={onAddFeed}
              disabled={loading || !feedName.trim() || !feedUrl.trim()}
            >
              Add
            </PrimaryButton>
          </div>
        </div>
      </div>

      {feedsToAdd.length > 0 && (
        <div className="max-h-40 overflow-y-auto border border-primary-200 dark:border-primary-900 rounded-xl">
          {feedsToAdd.map((feed) => (
            <div
              key={feed.url}
              className="flex items-center justify-between px-4 py-3 border-b border-primary-200 dark:border-primary-900 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <BodyMedium>{feed.name}</BodyMedium>
                <Caption className="truncate">{feed.url}</Caption>
              </div>
              <WarningButton
                onClick={() => onRemoveFeed(feed.url)}
                disabled={loading}
                size="xs"
                className="ml-3"
              >
                Remove
              </WarningButton>
            </div>
          ))}
        </div>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex justify-between gap-3 pt-2">
        <GhostButton onClick={onBack} disabled={loading}>
          Back
        </GhostButton>
        <PrimaryButton
          onClick={onSave}
          disabled={loading || feedsToAdd.length === 0}
          isLoading={loading}
        >
          {loading ? "Saving..." : `Save (${feedsToAdd.length} Feeds)`}
        </PrimaryButton>
      </div>
    </div>
  );
}

interface ManageFeedsStepProps {
  feeds: RssFeed[];
  onAddNew: () => void;
  onRemove: (feedId: string) => void;
  onRevoke: () => void;
  loading: boolean;
  error: string;
}

function ManageFeedsStep({
  feeds,
  onAddNew,
  onRemove,
  onRevoke,
  loading,
  error,
}: ManageFeedsStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Muted>
          {feeds.length} {feeds.length === 1 ? "feed" : "feeds"} connected
        </Muted>
        <PrimaryButton onClick={onAddNew} disabled={loading} size="sm">
          Add Feed
        </PrimaryButton>
      </div>

      <div className="max-h-52 overflow-y-auto border border-primary-200 dark:border-primary-900 rounded-xl">
        {feeds.length === 0 ? (
          <div className="p-8 text-center">
            <Muted>No RSS feeds connected yet.</Muted>
            <PrimaryButton
              onClick={onAddNew}
              disabled={loading}
              className="mt-3"
            >
              Add feeds
            </PrimaryButton>
          </div>
        ) : (
          feeds.map((feed) => (
            <div
              key={feed.id}
              className="flex items-center justify-between px-4 py-3 border-b border-primary-200 dark:border-primary-900 last:border-b-0"
            >
              <div className="flex-1">
                <BodyMedium>{feed.name}</BodyMedium>
                {feed.metadata?.url && (
                  <Caption className="mt-0.5 truncate">
                    {feed.metadata.url}
                  </Caption>
                )}
              </div>
              <WarningButton
                onClick={() => onRemove(feed.id)}
                disabled={loading}
                size="xs"
              >
                Remove
              </WarningButton>
            </div>
          ))
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex justify-end">
        <DangerButton onClick={onRevoke} disabled={loading}>
          Disconnect RSS
        </DangerButton>
      </div>
    </div>
  );
}
