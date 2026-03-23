import { Caption, Muted, Button, toast } from "@/components/ui";
import { useGetProjectResourcesQuery, useRemoveProjectResourceMutation } from "@/lib/redux/api";
import { SettingsSection, SettingsDivider } from "../settings-layout";
import { Close, Plus } from "@/components/ui/icons";
import { ResourceIcon } from "@/features/workspace/components/provider-icon";

interface ProjectLinkedResourcesProps {
  projectId: string;
  onManageClick: () => void;
}

export function ProjectLinkedResources({ projectId, onManageClick }: ProjectLinkedResourcesProps) {
  const { data: linkedResources = [] } = useGetProjectResourcesQuery(projectId);
  const [removeResource] = useRemoveProjectResourceMutation();

  const handleRemove = async (resourceId: string) => {
    try {
      await removeResource({ projectId, resourceId }).unwrap();
      toast.success("Resource removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove resource");
    }
  };

  return (
    <SettingsSection title="Linked Resources">
      {linkedResources.length === 0 ? (
        <div className="py-5">
          <Muted className="text-sm">No resources linked to this project.</Muted>
        </div>
      ) : (
        <div>
          {linkedResources.map((r, i) => (
            <div key={r.id}>
              {i > 0 && <SettingsDivider />}
              <div className="flex items-center gap-3 py-4">
                <span className="text-primary-500 dark:text-primary-400 shrink-0">
                  <ResourceIcon kind={r.resource.kind} />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-primary-900 dark:text-primary-100 truncate block">
                    {r.resource.name || r.resource.externalId}
                  </span>
                  {r.resource.externalId !== r.resource.name && (
                    <Caption className="text-primary-400 dark:text-primary-500 truncate block">
                      {r.resource.externalId}
                    </Caption>
                  )}
                </div>
                <button
                  type="button"
                  className="shrink-0 p-1.5 rounded-full hover:bg-primary-200/60 dark:hover:bg-primary-800/60 transition-colors cursor-pointer"
                  onClick={() => handleRemove(r.resourceId)}
                >
                  <Close className="w-3 h-3 text-primary-400  transition-colors" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <SettingsDivider />
      <div className="py-4 flex justify-end">
        <Button
          type="button"
          variant="primary"
          className="flex items-center gap-1.5 "
          onClick={onManageClick}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Manage resources</span>
        </Button>
      </div>
    </SettingsSection>
  );
}
