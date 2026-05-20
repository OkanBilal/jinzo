import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  BodyMedium,
  Caption,
  Heading3,
  Button,
  Checkbox,
  toast,
} from "@/components/ui";
import { extractErrorMessage } from "@/lib/extract-error-message";
import {
  useListAvailableResourcesQuery,
  useAddProjectResourceMutation,
  useRemoveProjectResourceMutation,
  type AvailableResource,
} from "@/lib/redux/api";
import { ResourceIcon } from "./provider-icon";
import { Connect } from "@/components/ui/icons";

interface LinkResourcesModalProps {
  projectId: string;
  workspaceName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LinkResourcesModal({
  projectId,
  isOpen,
  onClose,
}: LinkResourcesModalProps) {
  const navigate = useNavigate();

  const goToApps = useCallback(() => {
    onClose();
    navigate("/settings?section=connections");
  }, [navigate, onClose]);

  const {
    data: resources = [],
    isLoading,
  } = useListAvailableResourcesQuery(projectId, {
    skip: !isOpen || !projectId,
    refetchOnMountOrArgChange: true,
  });

  const [addResource] = useAddProjectResourceMutation();
  const [removeResource] = useRemoveProjectResourceMutation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState("");

  // Initialize selected state from currently linked resources
  useEffect(() => {
    if (isOpen && resources.length > 0) {
      const linkedIds = new Set(
        resources.filter((r) => r.isLinked).map((r) => r.id),
      );
      queueMicrotask(() => setSelectedIds(linkedIds));
    }
  }, [isOpen, resources]);

  // Reset error when modal opens
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setError("");
  }
  if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  // Calculate changes
  const { toAdd, toRemove, hasChanges } = useMemo(() => {
    const initialLinked = new Set(
      resources.filter((r) => r.isLinked).map((r) => r.id),
    );
    const toAdd = [...selectedIds].filter((id) => !initialLinked.has(id));
    const toRemove = [...initialLinked].filter((id) => !selectedIds.has(id));
    return {
      toAdd,
      toRemove,
      hasChanges: toAdd.length > 0 || toRemove.length > 0,
    };
  }, [selectedIds, resources]);

  if (!isOpen) return null;

  const toggleResource = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Remove unlinked resources
      for (const id of toRemove) {
        await removeResource({ projectId, resourceId: id }).unwrap();
      }

      // Add newly linked resources
      for (const id of toAdd) {
        await addResource({ projectId, resourceId: id }).unwrap();
      }

      const totalChanges = toAdd.length + toRemove.length;
      toast.success(
        `Updated ${totalChanges} resource${totalChanges > 1 ? "s" : ""}`,
      );
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to update resources"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedIds(
      new Set(resources.filter((r) => r.isLinked).map((r) => r.id)),
    );
    onClose();
  };


  const renderResourceItem = (resource: AvailableResource) => {
    const selected = selectedIds.has(resource.id);
    const icon = <ResourceIcon kind={resource.kind} />;

    return (
      <div
        key={resource.id}
        role="button"
        tabIndex={0}
        onClick={() => !saving && toggleResource(resource.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!saving) toggleResource(resource.id); } }}
        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-150 dark:bg-primary-950/50 bg-primary ${
          selected
            ? ""
            : ""
        }`}
      >
        <span className="text-primary-500 dark:text-primary-400">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex gap-2 items-center">
            <BodyMedium
              className={`truncate font-medium ${selected ? "text-primary-900 dark:text-primary-100" : ""}`}
            >
              {resource.name || resource.externalId}
            </BodyMedium>
            {resource.externalId !== resource.name && (
              <Caption className="text-primary-400 dark:text-primary-500 truncate block mt-0.5">
                {resource.externalId}
              </Caption>
            )}
          </div>
        </div>
        <Checkbox
          checked={selected}
          onChange={() => toggleResource(resource.id)}
          disabled={saving}
        />
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-(--z-overlay) flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-primary-950/50" role="presentation" onClick={handleCancel} />

      {/* Modal */}
      <div
        className="relative z-(--z-overlay) w-full max-w-xl rounded-3xl overflow-hidden glass-morphism"
        style={{
          animation: "wizardModalIn 250ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <Heading3 className="text-primary-900 dark:text-primary-50">
            Link Resources
          </Heading3>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">
          <div className="flex items-center gap-2"></div>

          <div className="max-h-64 overflow-y-auto border border-primary-200/60 bg-primary dark:bg-primary-950 dark:border-primary-800/40 rounded-2xl ">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2">
                  <span className="text-sm shine-text">
                    Loading resources...
                  </span>
                </div>
              </div>
            ) : resources.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <Connect className="size-6 mb-3 text-primary-400 dark:text-primary-700" />
                <BodyMedium className="text-primary-600 dark:text-primary-300">
                  No resources available
                </BodyMedium>
                <Caption className="text-primary-400 dark:text-primary-500 mt-1 block">
                  Connect apps in{" "}
                  <Button
                    type="button"
                    onClick={goToApps}
                    className="underline dark:hover:text-primary-300 hover:text-primary-600 transition-colors cursor-pointer"
                  >
                    settings
                  </Button>{" "}
                  first
                </Caption>
              </div>
            ) : (
              <div className="divide-y divide-primary-200/60 dark:divide-primary-800/40">
                {resources.map(renderResourceItem)}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-3 pt-2">
            <Button variant="ghost" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="submit"
              onClick={handleSave}
              disabled={saving}
              isLoading={saving}
            >
              {saving ? "Saving..." : "Done"}
            </Button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes wizardModalIn {
          0% {
            opacity: 0;
            transform: scale(0.2);
          }
          70% {
            opacity: 1;
            transform: scale(1.015);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes wizardStepFade {
          from { opacity: 0.6; }
          to { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
