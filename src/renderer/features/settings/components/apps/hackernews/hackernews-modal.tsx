import { useState, useEffect, useCallback } from "react";

import {
  BodyMedium,
  Caption,
  Muted,
  ErrorText,
} from "../../../../../components/ui/text";
import {
  ConnectionModalWrapper,
  LoadingState,
  RevokeConfirmModal,
} from "../shared";
import {
  Button
} from "../../../../../components/ui/button";
import {
  useLazyGetHackerNewsStatusQuery,
  useUpdateHackerNewsSettingsMutation,
  useRevokeConnectionMutation,
} from "../../../../../lib/redux/api";

interface HackerNewsModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "enable" | "configure";

export default function HackerNewsModal({
  open,
  onClose,
}: HackerNewsModalProps) {
  const [step, setStep] = useState<Step>("enable");
  const [enabled, setEnabled] = useState(false);
  const [username, setUsername] = useState("");
  const [topStories, setTopStories] = useState(true);
  const [userSubmissions, setUserSubmissions] = useState(false);
  const [userComments, setUserComments] = useState(false);
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const [getHackerNewsStatus] = useLazyGetHackerNewsStatusQuery();
  const [updateSettings, { isLoading }] = useUpdateHackerNewsSettingsMutation();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  const loading = isLoading || isRevoking;

  const loadCurrentSettings = useCallback(async () => {
    try {
      const result = await getHackerNewsStatus().unwrap();

      if (result.success) {
        const isEnabled = result.enabled;
        setEnabled(isEnabled);
        setUsername(result.username || "");
        setTopStories(result.settings.topStories);
        setUserSubmissions(result.settings.userSubmissions);
        setUserComments(result.settings.userComments);
        setStep(isEnabled ? "configure" : "enable");
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to load settings");
    }
  }, [getHackerNewsStatus]);

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
    setError("");
    setInitializing(false);
    onClose();
  };

  const handleEnableContinue = async () => {
    setError("");

    if (enabled) {
      try {
        await updateSettings({
          enabled: true,
          username: username.trim() || null,
          topStories: false,
          userSubmissions: false,
          userComments: false,
        }).unwrap();

        setStep("configure");
      } catch (err: any) {
        setError(err?.data?.error || err?.message || "An error occurred");
      }
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    if ((userSubmissions || userComments) && !username.trim()) {
      setError("Username is required for user submissions and comments");
      return;
    }

    setError("");

    try {
      await updateSettings({
        enabled,
        username: username.trim() || null,
        topStories,
        userSubmissions,
        userComments,
      }).unwrap();

      handleClose();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleDisconnect = async () => {
    setShowRevokeConfirm(true);
  };

  const handleConfirmRevoke = async () => {
    setError("");
    setShowRevokeConfirm(false);

    try {
      await revokeConnection("hackernews").unwrap();
      handleClose();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  return (
    <>
      <ConnectionModalWrapper
        open={open}
        onClose={handleClose}
        appName="HackerNews Connection"
        appIcon="/apps/hackernews-skeuomorphic.png"
      >
        {initializing ? (
          <LoadingState message="Loading settings..." />
        ) : step === "enable" ? (
          <EnableStep
            enabled={enabled}
            onEnabledChange={setEnabled}
            onContinue={handleEnableContinue}
            loading={isLoading}
            error={error}
          />
        ) : (
          <ConfigureStep
            username={username}
            topStories={topStories}
            userSubmissions={userSubmissions}
            userComments={userComments}
            onUsernameChange={setUsername}
            onTopStoriesChange={setTopStories}
            onUserSubmissionsChange={setUserSubmissions}
            onUserCommentsChange={setUserComments}
            onSave={handleSave}
            onDisconnect={handleDisconnect}
            loading={loading}
            error={error}
          />
        )}
      </ConnectionModalWrapper>

      {showRevokeConfirm && (
        <RevokeConfirmModal
          appName="HackerNews"
          onConfirm={handleConfirmRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={loading}
        />
      )}
    </>
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
      <Muted>Enable HackerNews to add stories to your feed.</Muted>

      <div className="flex items-center justify-between p-4 bg-primary-100 dark:bg-primary-800 rounded-xl">
        <BodyMedium>Enable HackerNews</BodyMedium>
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
        <Button
          variant="primary"
          onClick={onContinue}
          disabled={loading}
          isLoading={loading}
        >
          {enabled ? "Configure" : "Save"}
        </Button>
      </div>
    </div>
  );
}

interface ConfigureStepProps {
  username: string;
  topStories: boolean;
  userSubmissions: boolean;
  userComments: boolean;
  onUsernameChange: (username: string) => void;
  onTopStoriesChange: (value: boolean) => void;
  onUserSubmissionsChange: (value: boolean) => void;
  onUserCommentsChange: (value: boolean) => void;
  onSave: () => void;
  onDisconnect: () => void;
  loading: boolean;
  error: string;
}

function ConfigureStep({
  username,
  topStories,
  userSubmissions,
  userComments,
  onUsernameChange,
  onTopStoriesChange,
  onUserSubmissionsChange,
  onUserCommentsChange,
  onSave,
  onDisconnect,
  loading,
  error,
}: ConfigureStepProps) {
  return (
    <div className="space-y-4">
      <Muted>Configure what content to fetch from HackerNews.</Muted>

      <div>
        <label htmlFor="hn-username" className="block mb-2">
          <BodyMedium>Username (Optional)</BodyMedium>
        </label>
        <input
          id="hn-username"
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="your_username"
          className="w-full px-3 py-2.5 bg-white dark:bg-primary-100 rounded-xl text-primary-900 dark:text-primary-900 placeholder:text-primary-400 dark:placeholder:text-primary-600 focus:outline-none"
          disabled={loading}
        />
        <Caption className="mt-1">
          Required if you want to fetch your submissions or comments
        </Caption>
      </div>

      <div>
        <BodyMedium className="block mb-2">What to fetch:</BodyMedium>
        <div className="max-h-40 overflow-y-auto border border-primary-200 dark:border-primary-900 rounded-xl">
          <label className="flex items-center cursor-pointer border-b border-primary-200 dark:border-primary-900 last:border-b-0 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors">
            <div className="flex-1 p-4">
              <BodyMedium>Top Stories</BodyMedium>
              <Caption>Latest top stories from HackerNews</Caption>
            </div>
            <input
              type="checkbox"
              checked={topStories}
              onChange={(e) => onTopStoriesChange(e.target.checked)}
              className="w-4 h-4 mr-4 text-primary-600 dark:text-primary-400 rounded cursor-pointer"
              disabled={loading}
            />
          </label>

          <label className="flex items-center cursor-pointer border-b border-primary-200 dark:border-primary-900 last:border-b-0 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors">
            <div className="flex-1 p-4">
              <BodyMedium>My Submissions</BodyMedium>
              <Caption>Your submitted stories (requires username)</Caption>
            </div>
            <input
              type="checkbox"
              checked={userSubmissions}
              onChange={(e) => onUserSubmissionsChange(e.target.checked)}
              className="w-4 h-4 mr-4 text-primary-600 dark:text-primary-400 rounded cursor-pointer"
              disabled={loading || !username.trim()}
            />
          </label>

          <label className="flex items-center cursor-pointer last:border-b-0 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors">
            <div className="flex-1 p-4">
              <BodyMedium>My Comments</BodyMedium>
              <Caption>Your comments on stories (requires username)</Caption>
            </div>
            <input
              type="checkbox"
              checked={userComments}
              onChange={(e) => onUserCommentsChange(e.target.checked)}
              className="w-4 h-4 mr-4 text-primary-600 dark:text-primary-400 rounded cursor-pointer"
              disabled={loading || !username.trim()}
            />
          </label>
        </div>
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex justify-between gap-3 pt-2">
        <Button variant="danger" onClick={onDisconnect} disabled={loading}>
          Disconnect
        </Button>
        <Button variant="primary" onClick={onSave} disabled={loading} isLoading={loading}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
