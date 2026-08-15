import { useCallback, useState } from "react";
import { PullRequest } from "@/components/ui/icons";
import { Input, Textarea, toast } from "@/components/ui";
import {
  useCreatePrGitFlowMutation,
  useGeneratePrBodyGitFlowMutation,
} from "@/lib/redux/api";
import { extractErrorMessage } from "@/lib/extract-error-message";
import { PanelItem, PanelCollapse, PANEL_ROW_X } from "../panel-item";
import { CheckboxOption, GenerateButton } from "./controls";
import type { GitActionsPanel } from "./use-git-actions-panel";

/**
 * Open a pull request from the checked-out branch. Offered only when the repo
 * has a remote; the Publish section takes this slot when it doesn't.
 */
export function PrSection({
  panel,
  providerId,
  onClose,
}: {
  panel: GitActionsPanel;
  providerId?: string;
  /** Closes the whole panel — a created PR dismisses it. */
  onClose: () => void;
}) {
  const {
    workspaceId,
    isDefaultBranch,
    pending,
    setPending,
    busy,
    isSectionOpen,
    toggleSection,
  } = panel;

  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [prDraft, setPrDraft] = useState(false);

  const [createPrGitFlow] = useCreatePrGitFlowMutation();
  const [generatePrBody, { isLoading: generatingPr }] =
    useGeneratePrBodyGitFlowMutation();

  /** Explicit generation for the PR form — fills title + body. */
  const handleGeneratePr = useCallback(() => {
    if (!providerId || generatingPr) return;
    generatePrBody({ workspaceId, providerId })
      .unwrap()
      .then((generated) => {
        setPrTitle(generated.title);
        setPrBody(generated.body);
      })
      .catch((err) =>
        toast.error(extractErrorMessage(err, "Failed to generate the PR description.")),
      );
  }, [workspaceId, providerId, generatingPr, generatePrBody]);

  const handleCreatePr = useCallback(async () => {
    if (pending) return;
    setPending("pr");
    const toastId = toast.loading("Creating pull request…");
    try {
      const result = await createPrGitFlow({
        workspaceId,
        title: prTitle.trim() || undefined,
        body: prBody.trim() || undefined,
        draft: prDraft,
        providerId,
      }).unwrap();
      toast.success("Pull request created", { id: toastId });
      if (result.url) window.api.shell.openExternal(result.url);
      onClose();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to create PR", {
        id: toastId,
      });
    } finally {
      setPending(null);
    }
  }, [
    workspaceId,
    pending,
    setPending,
    createPrGitFlow,
    prTitle,
    prBody,
    prDraft,
    providerId,
    onClose,
  ]);

  return (
    <>
      <PanelItem
        icon={<PullRequest className="size-4" />}
        label="Create pull request"
        expandable
        expanded={isSectionOpen("pr")}
        onClick={() => toggleSection("pr")}
        disabled={isDefaultBranch}
        title={
          isDefaultBranch
            ? "Already on the default branch — nothing to open a PR from."
            : undefined
        }
      />
      <PanelCollapse isOpen={isSectionOpen("pr")}>
        <div className={`space-y-2 pt-2 pb-1 ${PANEL_ROW_X}`}>
          <Input
            type="text"
            value={prTitle}
            onChange={(e) => setPrTitle(e.target.value)}
            placeholder={
              generatingPr
                ? "Generating PR title…"
                : "PR title (leave blank to generate)…"
            }
            className="w-full text-xs"
          />
          <div className="relative">
            <Textarea
              value={prBody}
              onChange={(e) => setPrBody(e.target.value)}
              rows={4}
              placeholder={
                generatingPr
                  ? "Generating description…"
                  : "Description (optional, leave blank to generate)…"
              }
              className="w-full text-xs pb-8"
            />
            <GenerateButton
              onClick={handleGeneratePr}
              disabled={busy || generatingPr}
              generating={generatingPr}
              tooltip="Generate the title and description from the branch"
            />
          </div>
          <CheckboxOption
            checked={prDraft}
            onChange={() => setPrDraft((v) => !v)}
            className="mb-1 -mt-1"
          >
            Create as draft
          </CheckboxOption>
        </div>
        <PanelItem
          icon={<PullRequest className="size-4" />}
          label="Create pull request"
          onClick={handleCreatePr}
          disabled={busy}
          loading={pending === "pr"}
        />
      </PanelCollapse>
    </>
  );
}
