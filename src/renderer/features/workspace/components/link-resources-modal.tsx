import { useState, useEffect, useMemo } from "react";
import {
  BodyMedium,
  Caption,
  Muted,
  ErrorText,
  Heading3,
} from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useGetAvailableResourcesQuery,
  useAddWorkspaceResourceMutation,
  useRemoveWorkspaceResourceMutation,
  type AvailableResource,
} from "@/lib/redux/api";
import { toast } from "@/components/ui/toast";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";
import { Apps, Asana, Gitlab, Jira } from "@/components/ui/icons";

interface LinkResourcesModalProps {
  workspaceId: string;
  workspaceName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LinkResourcesModal({
  workspaceId,
  workspaceName,
  isOpen,
  onClose,
}: LinkResourcesModalProps) {
  const {
    data: resources = [],
    isLoading,
  } = useGetAvailableResourcesQuery(workspaceId, {
    skip: !isOpen,
    refetchOnMountOrArgChange: true,
  });

  const [addResource] = useAddWorkspaceResourceMutation();
  const [removeResource] = useRemoveWorkspaceResourceMutation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Initialize selected state from currently linked resources
  useEffect(() => {
    if (isOpen && resources.length > 0) {
      const linkedIds = new Set(
        resources.filter((r) => r.isLinked).map((r) => r.id),
      );
      setSelectedIds(linkedIds);
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
        await removeResource({ workspaceId, resourceId: id }).unwrap();
      }

      // Add newly linked resources
      for (const id of toAdd) {
        await addResource({ workspaceId, resourceId: id }).unwrap();
      }

      const totalChanges = toAdd.length + toRemove.length;
      toast.success(
        `Updated ${totalChanges} resource${totalChanges > 1 ? "s" : ""}`,
      );
      onClose();
    } catch (err: any) {
      setError(
        err?.data?.error || err?.message || "Failed to update resources",
      );
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

  const getResourceLabel = (kind: string) => {
    switch (kind) {
      case "github_repo":
        return "GitHub";
      case "linear_team":
        return "Linear";
      case "jira_project":
        return "Jira";
      default:
        return kind;
    }
  };

  const renderResourceItem = (resource: AvailableResource) => {
    const selected = selectedIds.has(resource.id);
    const icon =
      resource.kind === "github_repo" ? (
        <Github className="w-4 h-4 shrink-0" />
      ) : resource.kind === "jira_project" ? (
        <Jira className="size-5 shrink-0" />
      ) : resource.kind === "linear_team" ? (
        <Linear className="w-4 h-4 shrink-0" />
      ) : resource.kind === "asana_project" ? (
        <Asana className="h-5.5 w-6 scale-80 shrink-0" />
      ) : resource.kind === "gitlab_project" ? (
        <Gitlab className="w-4 h-4 shrink-0" />
      ) : (
        <Apps className="w-4 h-4 shrink-0" />
      );

    return (
      <div
        key={resource.id}
        role="button"
        tabIndex={0}
        onClick={() => !saving && toggleResource(resource.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); !saving && toggleResource(resource.id); } }}
        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-150 ${
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

  const selectedCount = selectedIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" role="presentation" onClick={handleCancel} />

      {/* Modal */}
      <div
        className="relative z-50 w-full max-w-xl rounded-3xl overflow-hidden glass-morphism"
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

          <div className="max-h-64 overflow-y-auto border border-primary-200/60 dark:border-primary-800/60 rounded-2xl ">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2">
                  <span className="text-sm shine-text">
                    Loading resources...
                  </span>
                </div>
              </div>
            ) : resources.length === 0 ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-800/60 mb-3"></div>
                <BodyMedium className="text-primary-600 dark:text-primary-300">
                  No resources available
                </BodyMedium>
                <Caption className="text-primary-400 dark:text-primary-500 mt-1 block">
                  Connect apps in settings first
                </Caption>
              </div>
            ) : (
              <div className="divide-y divide-primary-100 dark:divide-primary-800/60">
                {resources.map(renderResourceItem)}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-3 pt-2">
            <Button variant="link" onClick={handleCancel} disabled={saving}>
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
    </div>
  );
}
