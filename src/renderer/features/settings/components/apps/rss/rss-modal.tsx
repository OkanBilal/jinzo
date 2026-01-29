import { useState, useEffect, useCallback } from "react";

import {
  BodyMedium,
  Caption,
  Muted,
  ErrorText,
} from "../../../../../components/ui/text";
import {
  WizardModal,
  useWizard,
  type WizardStep,
} from "../../../../../components/ui/wizard-modal";
import { RevokeConfirmModal } from "../shared";
import { Button } from "../../../../../components/ui/button";
import {
  useLazyGetRssStatusQuery,
  useUpdateRssSettingsMutation,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
  RssFeed,
} from "../../../../../lib/redux/api";
import { Input } from "@/components/ui/input";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RssModalProps {
  open: boolean;
  onClose: () => void;
}

interface RssWizardData {
  enabled: boolean;
  connectionId: string;
  feedName: string;
  feedUrl: string;
  feedsToAdd: Array<{ name: string; url: string }>;
  currentFeeds: RssFeed[];
  fromManage: boolean;
}

type StepId = "loading" | "enable" | "add" | "manage";

// ─────────────────────────────────────────────────────────────────────────────
// Step: Loading
// ─────────────────────────────────────────────────────────────────────────────

function LoadingStep() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <Muted className="shine-text">Loading RSS feeds...</Muted>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Enable
// ─────────────────────────────────────────────────────────────────────────────

function EnableStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } = useWizard<RssWizardData>();
  const [loading, setLoading] = useState(false);
  const [updateSettings] = useUpdateRssSettingsMutation();

  const handleContinue = async () => {
    setLoading(true);
    setErrors({ general: "" });

    try {
      if (data.enabled) {
        const enableResult = await updateSettings({ enabled: true }).unwrap();
        const newConnectionId = enableResult.connectionId || "";

        if (!newConnectionId) {
          throw new Error("No connection ID returned from server");
        }

        setData({ connectionId: newConnectionId, fromManage: false });
        goTo("add");
      } else {
        await updateSettings({ enabled: false }).unwrap();
        onComplete();
      }
    } catch (err: any) {
      setErrors({
        general: err?.data?.error || err?.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Muted>Enable RSS to add custom RSS feeds to your feed.</Muted>

      <div className="flex items-center justify-between py-4 px-4 dark:bg-primary-900 bg-primary-200/60 rounded-xl">
        <BodyMedium>Enable RSS</BodyMedium>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={data.enabled}
            onChange={(e) => setData({ enabled: e.target.checked })}
            className="sr-only peer"
            disabled={loading}
          />
          <div className="w-11 h-6 dark:bg-primary-600 bg-primary  peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-primary after:border-primary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-300 dark:peer-checked:bg-primary-300"></div>
        </label>
      </div>

      {errors.general && <ErrorText>{errors.general}</ErrorText>}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="primary"
          onClick={handleContinue}
          disabled={loading}
          isLoading={loading}
        >
          {data.enabled ? "Add Feeds" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Add Feeds
// ─────────────────────────────────────────────────────────────────────────────

function AddFeedsStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } = useWizard<RssWizardData>();
  const [loading, setLoading] = useState(false);
  const [saveResources] = useSaveResourcesMutation();
  const [getRssStatus] = useLazyGetRssStatusQuery();

  const feedsToAdd = data.feedsToAdd || [];

  const handleAddFeed = () => {
    if (!data.feedName?.trim() || !data.feedUrl?.trim()) {
      setErrors({ add: "Please enter both name and URL" });
      return;
    }

    try {
      new URL(data.feedUrl.trim());
    } catch {
      setErrors({ add: "Please enter a valid URL" });
      return;
    }

    if (feedsToAdd.some((f) => f.url === data.feedUrl.trim())) {
      setErrors({ add: "This feed URL is already in the list" });
      return;
    }

    setData({
      feedsToAdd: [
        ...feedsToAdd,
        { name: data.feedName.trim(), url: data.feedUrl.trim() },
      ],
      feedName: "",
      feedUrl: "",
    });
    setErrors({ add: "" });
  };

  const handleRemoveFeedFromList = (url: string) => {
    setData({ feedsToAdd: feedsToAdd.filter((f) => f.url !== url) });
  };

  const handleSave = async () => {
    if (feedsToAdd.length === 0) {
      setErrors({ add: "Please add at least one RSS feed" });
      return;
    }

    setLoading(true);
    setErrors({ add: "" });

    try {
      if (!data.connectionId) {
        throw new Error("Failed to create RSS connection");
      }

      const feeds = feedsToAdd.map((feed) => ({
        name: feed.name,
        url: feed.url,
      }));

      await saveResources({
        provider: "rss",
        connectionId: data.connectionId,
        resources: feeds,
      }).unwrap();

      // Reload current feeds
      const result = await getRssStatus().unwrap();
      if (result.success) {
        setData({
          feedsToAdd: [],
          currentFeeds: result.feeds || [],
        });
      }

      if (data.fromManage) {
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrors({
        add: err?.data?.error || err?.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (data.fromManage) {
      goTo("manage");
    } else {
      goTo("enable");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label htmlFor="rss-feed-name" className="block mb-2">
            <BodyMedium>Feed Name</BodyMedium>
          </label>
          <Input
            id="rss-feed-name"
            type="text"
            value={data.feedName || ""}
            onChange={(e) => setData({ feedName: e.target.value })}
            placeholder="e.g., Tech Blog, News Feed"
            className="w-full px-3 py-2.5 dark:bg-primary! shadow-none! dark:placeholder:text-primary-800! dark:text-primary-900 "
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="rss-feed-url" className="block mb-2">
            <BodyMedium>Feed URL</BodyMedium>
          </label>
          <div className="flex gap-2">
            <Input
              id="rss-feed-url"
              type="url"
              value={data.feedUrl || ""}
              onChange={(e) => setData({ feedUrl: e.target.value })}
              placeholder="https://example.com/feed.xml"
              className="flex-1 px-3 py-2.5 dark:bg-primary! shadow-none! dark:placeholder:text-primary-800! dark:text-primary-900 "
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddFeed();
              }}
            />
            <Button
              variant="submit"
              onClick={handleAddFeed}
              disabled={loading || !data.feedName?.trim() || !data.feedUrl?.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      {feedsToAdd.length > 0 && (
        <div className="max-h-40 overflow-y-auto border border-primary-200 dark:border-primary-800 rounded-xl">
          {feedsToAdd.map((feed) => (
            <div
              key={feed.url}
              className="flex items-center justify-between px-4 py-3 border-b border-primary-200 dark:border-primary-800 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <BodyMedium>{feed.name}</BodyMedium>
                <Caption className="truncate">{feed.url}</Caption>
              </div>
              <Button
                variant="warning"
                onClick={() => handleRemoveFeedFromList(feed.url)}
                disabled={loading}
                size="sm"
                className="ml-3"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {errors.add && <ErrorText>{errors.add}</ErrorText>}

      <div className="flex justify-between gap-3 pt-2">
        <Button
          variant="link"
          onClick={handleBack}
          disabled={loading}
          className="px-1"
        >
          Back
        </Button>
        <Button
          variant="submit"
          onClick={handleSave}
          disabled={loading || feedsToAdd.length === 0}
          isLoading={loading}
        >
          {loading ? "Saving..." : `Save (${feedsToAdd.length} Feeds)`}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Manage Feeds
// ─────────────────────────────────────────────────────────────────────────────

function ManageFeedsStep({ onRevoke }: { onRevoke: () => void }) {
  const { data, setData, errors, setErrors, goTo } = useWizard<RssWizardData>();
  const [loading, setLoading] = useState(false);
  const [deleteResource] = useDeleteResourceMutation();
  const [getRssStatus] = useLazyGetRssStatusQuery();

  const feeds = data.currentFeeds || [];

  const handleRemove = async (feedId: string) => {
    setLoading(true);
    setErrors({ manage: "" });

    try {
      await deleteResource(feedId).unwrap();
      const result = await getRssStatus().unwrap();
      if (result.success) {
        setData({ currentFeeds: result.feeds || [] });
      }
    } catch (err: any) {
      setErrors({
        manage: err?.data?.error || err?.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setData({ feedsToAdd: [], fromManage: true });
    goTo("add");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Muted>
          {feeds.length} {feeds.length === 1 ? "feed" : "feeds"} connected
        </Muted>
        <Button
          variant="submit"
          onClick={handleAddNew}
          disabled={loading}
        >
          Add Feed
        </Button>
      </div>

      <div className="max-h-52 overflow-y-auto border border-primary-200 dark:border-primary-800 rounded-xl">
        {feeds.length === 0 ? (
          <div className="p-8 text-center">
            <Muted>No RSS feeds connected yet.</Muted>

          </div>
        ) : (
          feeds.map((feed) => (
            <div
              key={feed.id}
              className="flex items-center justify-between px-4 py-3 border-b border-primary-200 dark:border-primary-800 last:border-b-0"
            >
              <div className="flex-1">
                <BodyMedium>{feed.name}</BodyMedium>
                {feed.metadata?.url && (
                  <Caption className="mt-0.5 truncate">
                    {feed.metadata.url}
                  </Caption>
                )}
              </div>
              <Button
                variant="warning"
                onClick={() => handleRemove(feed.id)}
                disabled={loading}
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>

      {errors.manage && <ErrorText>{errors.manage}</ErrorText>}

      <div className="flex justify-end">
        <Button variant="danger" onClick={onRevoke} disabled={loading}>
          Disconnect RSS
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function RssModal({ open, onClose }: RssModalProps) {
  const [initializing, setInitializing] = useState(true);
  const [initialStep, setInitialStep] = useState<StepId>("enable");
  const [initialData, setInitialData] = useState<Partial<RssWizardData>>({});
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const [getRssStatus] = useLazyGetRssStatusQuery();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  useEffect(() => {
    if (!open) {
      setInitializing(true);
      return;
    }

    const loadInitialData = async () => {
      setInitializing(true);
      const startTime = Date.now();

      let finalStep: StepId = "enable";
      let finalData: Partial<RssWizardData> = {
        enabled: false,
        connectionId: "",
        feedName: "",
        feedUrl: "",
        feedsToAdd: [],
        currentFeeds: [],
        fromManage: false,
      };

      try {
        const result = await getRssStatus().unwrap();

        if (result.success) {
          const isEnabled = result.enabled;
          finalData = {
            ...finalData,
            enabled: isEnabled,
            connectionId: result.connectionId || "",
            currentFeeds: result.feeds || [],
          };
          finalStep = isEnabled ? "manage" : "enable";
        }
      } catch (err) {
        console.error("[loadInitialData] Error:", err);
      }

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 600;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      setInitialStep(finalStep);
      setInitialData(finalData);
      setInitializing(false);
    };

    loadInitialData();
  }, [open, getRssStatus]);

  const handleClose = useCallback(() => {
    setShowRevokeConfirm(false);
    onClose();
  }, [onClose]);

  const handleRevoke = async () => {
    setShowRevokeConfirm(false);
    try {
      await revokeConnection("rss").unwrap();
      handleClose();
    } catch (err) {
      console.error("[handleRevoke] Error:", err);
    }
  };

  const handleRevokeClick = () => {
    setShowRevokeConfirm(true);
  };

  const steps: WizardStep<RssWizardData>[] = initializing
    ? [{ id: "loading", render: () => <LoadingStep /> }]
    : [
        {
          id: "enable",
          render: () => <EnableStep onComplete={handleClose} />,
        },
        {
          id: "add",
          render: () => <AddFeedsStep onComplete={handleClose} />,
        },
        {
          id: "manage",
          render: () => <ManageFeedsStep onRevoke={handleRevokeClick} />,
        },
      ];

  return (
    <>
      <WizardModal
        open={open}
        onOpenChange={(isOpen) => !isOpen && handleClose()}
        steps={steps}
        initialStep={initializing ? "loading" : initialStep}
        initialData={initialData}
        title="RSS"
        icon="/apps/rss-skeuomorphic.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          appName="RSS"
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          description="This will disconnect all RSS feeds and remove them from your feed. This action cannot be undone."
        />
      )}
    </>
  );
}
