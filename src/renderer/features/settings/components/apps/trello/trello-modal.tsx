import { useState, useReducer, useEffect, useCallback } from "react";

import { Body, Muted, WizardModal, useWizard, type WizardStep } from "@/components/ui";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetTrelloBoardsQuery,
  useLazyGetSelectedTrelloBoardsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
  type TrelloBoard,
  type SelectedTrelloBoard,
} from "@/lib/redux/api";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { toast } from "@/components/ui";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TrelloModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

interface TrelloWizardData {
  apiKey: string;
  token: string;
  connectionId: string;
  boards: TrelloBoard[];
  selectedBoards: Set<string>;
  currentBoards: SelectedTrelloBoard[];
  isFirstConnection: boolean;
  fromManage: boolean;
}

type StepId = "loading" | "setToken" | "add" | "manage";

// ─────────────────────────────────────────────────────────────────────────────
// Step: Set Token
// ─────────────────────────────────────────────────────────────────────────────

function TokenStep({ onSuccess }: { onSuccess?: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<TrelloWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();
  const [getTrelloBoards] = useLazyGetTrelloBoardsQuery();

  const handleSubmit = async () => {
    if (!data.apiKey?.trim()) {
      setErrors({ apiKey: "Please enter a valid API Key" });
      return;
    }
    if (!data.token?.trim()) {
      setErrors({ token: "Please enter a valid token" });
      return;
    }

    setLoading(true);
    setErrors({ apiKey: "", token: "" });

    try {
      const startTime = Date.now();
      const connectionResult = await getConnection("trello").unwrap();

      if (!connectionResult.success) {
        console.error("[Trello] Failed to get connection:", connectionResult);
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;

      await saveCredentials({
        provider: "trello",
        connectionId: connId,
        token: data.token,
        apiKey: data.apiKey,
      }).unwrap();

      onSuccess?.();

      const boardsResult = await getTrelloBoards(connId).unwrap();

      if (!boardsResult.success) {
        console.error("[Trello] Failed to fetch boards:", boardsResult);
        throw new Error("Failed to fetch boards");
      }

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 800;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      setData({
        connectionId: connId,
        boards: boardsResult.boards,
        isFirstConnection: true,
        fromManage: false,
      });

      goTo("add");
    } catch (err: any) {
      console.error("[Trello] Error in credential submit:", err);
      const errorMessage =
        err?.data?.error || err?.message || "An error occurred";
      setErrors({ token: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CredentialStep
      description="Enter your Trello API Key and Token to connect your boards."
      fields={[
        {
          id: "trello-api-key",
          label: "API Key",
          placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          value: data.apiKey || "",
          onChange: (value) => {
            setData({ apiKey: value });
            if (errors.apiKey) setErrors({ apiKey: "" });
          },
        },
        {
          id: "trello-token",
          label: "Token",
          placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          value: data.token || "",
          onChange: (value) => {
            setData({ token: value });
            if (errors.token) setErrors({ token: "" });
          },
        },
      ]}
      instructions={
        <>
          <strong>How to get your credentials:</strong>
          <br />
          1. Go to{" "}
          <a
            href="https://trello.com/power-ups/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 dark:text-primary-400 underline"
          >
            Trello Power-Ups Admin
          </a>
          <br />
          2. Click &quot;New&quot; to create a Power-Up, then copy your API Key
          <br />
          3. Next to your API Key, click the &quot;Token&quot; link to generate a token
          <br />
          4. Authorize the app and copy the token
        </>
      }
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.apiKey || errors.token || ""}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Select Boards
// ─────────────────────────────────────────────────────────────────────────────

function SelectBoardsStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<TrelloWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedBoards] = useLazyGetSelectedTrelloBoardsQuery();

  const selectedBoards = data.selectedBoards || new Set<string>();

  const toggleBoard = (boardId: string | number) => {
    const id = String(boardId);
    const next = new Set(selectedBoards);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setData({ selectedBoards: next });
  };

  const handleSave = async () => {
    if (selectedBoards.size === 0) {
      setErrors({ boards: "Please select at least one board" });
      return;
    }

    setLoading(true);
    setErrors({ boards: "" });

    try {
      const startTime = Date.now();

      const selectedBoardObjects = data.boards.filter((board) =>
        selectedBoards.has(board.id)
      );

      await saveResources({
        provider: "trello",
        connectionId: data.connectionId,
        resources: selectedBoardObjects,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1000;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      if (data.fromManage) {
        const result = await getSelectedBoards("trello").unwrap();
        if (result.success) {
          setData({
            currentBoards: result.boards,
            selectedBoards: new Set(),
          });
        }
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrors({ boards: err?.data?.error || err.message || "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (data.fromManage) {
      goTo("manage");
    } else if (data.isFirstConnection) {
      onComplete();
    } else {
      goTo("setToken");
    }
  };

  return (
    <SelectResourcesStep
      resources={data.boards.map((board) => ({ ...board, id: board.id }))}
      selectedResources={selectedBoards}
      onToggleResource={toggleBoard}
      onSave={handleSave}
      onBack={handleBack}
      loading={loading}
      error={errors.boards || ""}
      title="Select the boards you want to sync cards from."
      saveButtonLabel={`Save ${selectedBoards.size} Boards`}
      renderResourceItem={(board) => (
        <div className="flex items-center gap-2">
          <Body>{board.name}</Body>
          {board.organizationName && (
            <span className="text-xs text-primary-500">{board.organizationName}</span>
          )}
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Manage Boards
// ─────────────────────────────────────────────────────────────────────────────

function ManageBoardsStep({ onRevoke }: { onRevoke: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<TrelloWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getTrelloBoards] = useLazyGetTrelloBoardsQuery();
  const [getSelectedBoards] = useLazyGetSelectedTrelloBoardsQuery();

  const handleRemove = async (boardId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(boardId).unwrap();
      const result = await getSelectedBoards("trello").unwrap();
      if (result.success) {
        setData({ currentBoards: result.boards });
      }
    } catch (err: any) {
      setErrors({ manage: err?.data?.error || err.message || "An error occurred" });
    }
  };

  const handleAddNew = async () => {
    setLoading(true);
    setErrors({ manage: "" });

    try {
      const boardsResult = await getTrelloBoards(data.connectionId).unwrap();

      if (!boardsResult.success) {
        throw new Error("Failed to fetch boards");
      }

      const currentBoardIds = new Set(data.currentBoards.map((b) => b.boardId));
      const availableBoards = boardsResult.boards.filter(
        (board: TrelloBoard) => !currentBoardIds.has(board.id)
      );

      if (availableBoards.length === 0) {
        setErrors({ manage: "All boards are already connected" });
        return;
      }

      setData({
        boards: availableBoards,
        selectedBoards: new Set(),
        fromManage: true,
      });
      goTo("add");
    } catch (err: any) {
      setErrors({ manage: err?.data?.error || err.message || "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManageResourcesStep
      resources={data.currentBoards.map((b) => ({
        ...b,
        fullName: b.name,
      }))}
      onAddNew={handleAddNew}
      onRemove={handleRemove}
      onRevoke={onRevoke}
      loading={loading}
      error={errors.manage || ""}
      resourceLabel="board"
      resourceLabelPlural="boards"
      addButtonLabel="Add Board"
      revokeButtonLabel="Revoke Trello Access"
      renderResourceItem={(resource) => (
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Body>{resource.name}</Body>
            {resource.metadata?.organizationName && (
              <span className="text-xs text-primary-500">{resource.metadata.organizationName}</span>
            )}
          </div>
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading State
// ─────────────────────────────────────────────────────────────────────────────

function LoadingStep({ targetStep }: { targetStep: StepId | null }) {
  const { goTo } = useWizard<TrelloWizardData>();

  useEffect(() => {
    if (targetStep && targetStep !== "loading") {
      goTo(targetStep);
    }
  }, [targetStep, goTo]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <Muted className="shine-text">Loading boards...</Muted>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function TrelloModal({
  open,
  onClose,
  isConnected,
  onSuccess,
}: TrelloModalProps) {
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  type InitState = { initializing: boolean; targetStep: StepId | null; data: Partial<TrelloWizardData> };
  const [initState, setInitState] = useReducer(
    (_: InitState, next: InitState) => next,
    { initializing: true, targetStep: null, data: {} },
  );

  const [getSelectedBoards] = useLazyGetSelectedTrelloBoardsQuery();
  const [getConnection] = useLazyGetConnectionQuery();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  // Load initial data when modal opens
  useEffect(() => {
    if (!open) {
      setInitState({ initializing: true, targetStep: null, data: {} });
      return;
    }

    const loadInitialData = async () => {
      const baseData: Partial<TrelloWizardData> = {
        apiKey: "",
        token: "",
        boards: [],
        selectedBoards: new Set(),
        currentBoards: [],
        isFirstConnection: false,
        fromManage: false,
      };

      let finalStep: StepId = "setToken";
      let finalData: Partial<TrelloWizardData> = baseData;

      if (isConnected) {
        try {
          const startTime = Date.now();
          const result = await getSelectedBoards("trello").unwrap();

          if (result.success) {
            finalData = {
              ...baseData,
              connectionId: result.connectionId,
              currentBoards: result.boards,
            };
            finalStep = "manage";
          } else {
            const connResult = await getConnection("trello").unwrap();
            if (connResult.success) {
              finalData = {
                ...baseData,
                connectionId: connResult.connection.id,
                currentBoards: [],
              };
              finalStep = "manage";
            }
          }

          const elapsed = Date.now() - startTime;
          const minLoadingTime = 600;
          const remainingTime = Math.max(0, minLoadingTime - elapsed);
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        } catch (err) {
          console.error("[loadInitialData] Error:", err);
          try {
            const connResult = await getConnection("trello").unwrap();
            if (connResult.success) {
              finalData = {
                ...baseData,
                connectionId: connResult.connection.id,
                currentBoards: [],
              };
              finalStep = "manage";
            }
          } catch {
            // Keep defaults
          }
        }
      }

      setInitState({ initializing: false, targetStep: finalStep, data: finalData });
    };

    loadInitialData();
  }, [open, isConnected, getSelectedBoards, getConnection]);

  const handleClose = useCallback(() => {
    setShowRevokeConfirm(false);
    onClose();
  }, [onClose]);

  const handleRevoke = async () => {
    try {
      await revokeConnection("trello").unwrap();
      setShowRevokeConfirm(false);
      handleClose();
    } catch (err) {
      console.error("[handleRevoke] Error:", err);
      setShowRevokeConfirm(false);
      toast.error("Failed to revoke Trello access");
    }
  };

  const steps: WizardStep<TrelloWizardData>[] = [
    {
      id: "loading",
      render: () => <LoadingStep targetStep={initState.targetStep} />,
    },
    {
      id: "setToken",
      render: () => <TokenStep onSuccess={onSuccess} />,
    },
    {
      id: "add",
      render: () => <SelectBoardsStep onComplete={handleClose} />,
    },
    {
      id: "manage",
      render: () => (
        <ManageBoardsStep
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
        title="Trello"
        icon="connections/trello.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="Trello"
          description="This will disconnect all boards and remove all Trello data. This action cannot be undone."
        />
      )}
    </>
  );
}
