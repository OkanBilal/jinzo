import { useState, useReducer, useEffect, useCallback } from "react";

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
  useLazyGetHackerNewsStatusQuery,
  useUpdateHackerNewsSettingsMutation,
  useRevokeConnectionMutation,
} from "../../../../../lib/redux/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface HackerNewsModalProps {
  open: boolean;
  onClose: () => void;
}

interface HackerNewsWizardData {
  enabled: boolean;
  username: string;
  topStories: boolean;
  userSubmissions: boolean;
  userComments: boolean;
}

type StepId = "loading" | "enable" | "configure";

// ─────────────────────────────────────────────────────────────────────────────
// Step: Loading
// ─────────────────────────────────────────────────────────────────────────────

function LoadingStep({ targetStep }: { targetStep: StepId | null }) {
  const { goTo } = useWizard<HackerNewsWizardData>();

  useEffect(() => {
    if (targetStep && targetStep !== "loading") {
      goTo(targetStep);
    }
  }, [targetStep, goTo]);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Muted className=" shine-text">Loading settings...</Muted>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Enable
// ─────────────────────────────────────────────────────────────────────────────

function EnableStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<HackerNewsWizardData>();
  const [loading, setLoading] = useState(false);
  const [updateSettings] = useUpdateHackerNewsSettingsMutation();

  const handleContinue = async () => {
    if (data.enabled) {
      setLoading(true);
      try {
        await updateSettings({
          enabled: true,
          username: data.username?.trim() || null,
          topStories: false,
          userSubmissions: false,
          userComments: false,
        }).unwrap();

        goTo("configure");
      } catch (err: any) {
        setErrors({
          general: err?.data?.error || err?.message || "An error occurred",
        });
      } finally {
        setLoading(false);
      }
    } else {
      // If not enabled, just save and close
      setLoading(true);
      try {
        await updateSettings({
          enabled: false,
          username: null,
          topStories: false,
          userSubmissions: false,
          userComments: false,
        }).unwrap();
        onComplete();
      } catch (err: any) {
        setErrors({
          general: err?.data?.error || err?.message || "An error occurred",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <Muted>Enable HackerNews to add stories to your feed.</Muted>

      <div className="flex items-center justify-between py-4 px-4 dark:bg-primary-900 bg-primary-200/60 rounded-xl">
        <BodyMedium>Enable</BodyMedium>
        <label aria-label="Enable HackerNews" className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={data.enabled}
            onChange={(e) => setData({ enabled: e.target.checked })}
            className="sr-only peer"
            disabled={loading}
          />
          <div className="w-11 h-6 dark:bg-primary-600 bg-primary  peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-primary after:content-[''] after:absolute after:top-0.5 after:inset-s-0.5 after:bg-primary after:border-primary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-300 dark:peer-checked:bg-primary-300"></div>
        </label>
      </div>

      {errors.general && <ErrorText>{errors.general}</ErrorText>}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="submit"
          onClick={handleContinue}
          disabled={loading}
          isLoading={loading}
        >
          {data.enabled ? "Configure" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Configure
// ─────────────────────────────────────────────────────────────────────────────

function ConfigureStep({
  onComplete,
  onRevoke,
}: {
  onComplete: () => void;
  onRevoke: () => void;
}) {
  const { data, setData, errors, setErrors } =
    useWizard<HackerNewsWizardData>();
  const [loading, setLoading] = useState(false);
  const [updateSettings] = useUpdateHackerNewsSettingsMutation();

  const handleSave = async () => {
    if (
      (data.userSubmissions || data.userComments) &&
      !data.username?.trim()
    ) {
      setErrors({
        general: "Username is required for user submissions and comments",
      });
      return;
    }

    setLoading(true);
    try {
      await updateSettings({
        enabled: data.enabled,
        username: data.username?.trim() || null,
        topStories: data.topStories,
        userSubmissions: data.userSubmissions,
        userComments: data.userComments,
      }).unwrap();

      onComplete();
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
      <div>
        <label htmlFor="hn-username" className="block mb-2">
          <BodyMedium>Username (Optional)</BodyMedium>
        </label>
        <Input
          id="hn-username"
          type="text"
          value={data.username}
          onChange={(e) => setData({ username: e.target.value })}
          placeholder="your_username"
            className="w-full px-3 py-2.5 dark:bg-primary! shadow-none! dark:placeholder:text-primary-800! dark:text-primary-900 "
          disabled={loading}
        />
        <Caption className="mt-1">
          Required if you want to fetch your submissions or comments
        </Caption>
      </div>

      <div>
        <BodyMedium className="block mb-2">What to fetch:</BodyMedium>
        <div className="max-h-60 overflow-y-auto noscrollbar border border-primary-200 dark:border-primary-800 rounded-xl">
          <div className="flex items-center cursor-pointer border-b border-primary-200 dark:border-primary-800 last:border-b-0">
            <div className="flex-1 px-3 py-3">
              <BodyMedium>Top Stories</BodyMedium>
              <Caption>Latest top stories from HackerNews</Caption>
            </div>
            <div className="mr-4">
              <Checkbox
                checked={data.topStories}
                onChange={(checked) => setData({ topStories: checked })}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center cursor-pointer border-b border-primary-200 dark:border-primary-800 last:border-b-0 ">
            <div className="flex-1 px-3 py-3">
              <BodyMedium>My Submissions</BodyMedium>
              <Caption>Your submitted stories (requires username)</Caption>
            </div>
            <div className="mr-4">
              <Checkbox
                checked={data.userSubmissions}
                onChange={(checked) => setData({ userSubmissions: checked })}
                disabled={loading || !data.username?.trim()}
              />
            </div>
          </div>

          <div className="flex items-center cursor-pointer last:border-b-0 ">
            <div className="flex-1 px-3 py-3">
              <BodyMedium>My Comments</BodyMedium>
              <Caption>Your comments on stories (requires username)</Caption>
            </div>
            <div className="mr-4">
              <Checkbox
                checked={data.userComments}
                onChange={(checked) => setData({ userComments: checked })}
                disabled={loading || !data.username?.trim()}
              />
            </div>
          </div>
        </div>
      </div>

      {errors.general && <ErrorText>{errors.general}</ErrorText>}

      <div className="flex justify-between gap-3 pt-2">
        <Button variant="danger" onClick={onRevoke} disabled={loading}>
          Disconnect
        </Button>
        <Button
          variant="submit"
          onClick={handleSave}
          disabled={loading}
          isLoading={loading}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function HackerNewsModal({
  open,
  onClose,
}: HackerNewsModalProps) {
  type InitState = { initializing: boolean; targetStep: StepId | null; data: HackerNewsWizardData };
  const [initState, setInitState] = useReducer(
    (_: InitState, next: InitState) => next,
    { initializing: true, targetStep: null, data: { enabled: false, username: "", topStories: true, userSubmissions: false, userComments: false } },
  );
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const [getHackerNewsStatus] = useLazyGetHackerNewsStatusQuery();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  useEffect(() => {
    if (!open) {
      setInitState({ initializing: true, targetStep: null, data: { enabled: false, username: "", topStories: true, userSubmissions: false, userComments: false } });
      return;
    }

    const loadInitialData = async () => {
      const startTime = Date.now();

      let finalStep: StepId = "enable";
      let finalData: HackerNewsWizardData = {
        enabled: false,
        username: "",
        topStories: true,
        userSubmissions: false,
        userComments: false,
      };

      try {
        const result = await getHackerNewsStatus().unwrap();

        if (result.success) {
          finalData = {
            enabled: result.enabled,
            username: result.username || "",
            topStories: result.settings.topStories,
            userSubmissions: result.settings.userSubmissions,
            userComments: result.settings.userComments,
          };
          finalStep = result.enabled ? "configure" : "enable";
        }
      } catch (err) {
        console.error("[loadInitialData] Error:", err);
      }

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 600;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      setInitState({ initializing: false, targetStep: finalStep, data: finalData });
    };

    loadInitialData();
  }, [open, getHackerNewsStatus]);

  const handleClose = useCallback(() => {
    setShowRevokeConfirm(false);
    onClose();
  }, [onClose]);

  const handleRevoke = async () => {
    setShowRevokeConfirm(false);
    try {
      await revokeConnection("hackernews").unwrap();
      handleClose();
    } catch (err) {
      console.error("[handleRevoke] Error:", err);
    }
  };

  const steps: WizardStep<HackerNewsWizardData>[] = [
    {
      id: "loading",
      render: () => <LoadingStep targetStep={initState.targetStep} />,
    },
    {
      id: "enable",
      render: () => <EnableStep onComplete={handleClose} />,
    },
    {
      id: "configure",
      render: () => (
        <ConfigureStep
          onComplete={handleClose}
          onRevoke={() => setShowRevokeConfirm(true)}
        />
      ),
    },
  ];

  return (
    <>
      <WizardModal
        open={open}
        onOpenChange={(isOpen) => !isOpen && handleClose()}
        steps={steps}
        initialStep="loading"
        initialData={initState.data}
        title="HackerNews"
        icon="connections/hackernews.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          appName="HackerNews"
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
        />
      )}
    </>
  );
}
