import {
  Body,
  Muted,
  ErrorText,
  Caption,
} from "../../../../../components/ui/text";
import { Button } from "../../../../../components/ui/button";

interface Resource {
  id: string;
  name: string;
  [key: string]: any;
}

interface ManageResourcesStepProps {
  resources: Resource[];
  onAddNew: () => void;
  onRemove: (resourceId: string) => void;
  onRevoke: () => void;
  loading: boolean;
  error: string;
  resourceLabel?: string;
  resourceLabelPlural?: string;
  addButtonLabel?: string;
  revokeButtonLabel?: string;
  renderResourceItem?: (resource: Resource) => React.ReactNode;
}

export function ManageResourcesStep({
  resources,
  onAddNew,
  onRemove,
  onRevoke,
  loading,
  error,
  resourceLabel = "resource",
  resourceLabelPlural = "resources",
  addButtonLabel = "Add Resources",
  revokeButtonLabel = "Revoke Access",
  renderResourceItem,
}: ManageResourcesStepProps) {
  const count = resources.length;
  const label = count === 1 ? resourceLabel : resourceLabelPlural;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Muted>
          {count} {label} connected
        </Muted>
        <Button
          variant="primary"
          onClick={onAddNew}
          disabled={loading}
          size="sm"
        >
          {addButtonLabel}
        </Button>
      </div>

      <div className="min-h-12 max-h-52  overflow-y-auto border border-primary-200 dark:border-primary-800 rounded-xl">
        {count === 0 ? (
          <div className="p-8 text-center ">
            <Body>No {resourceLabelPlural} connected yet.</Body>

          </div>
        ) : (
          resources.map((resource) => (
            <div
              key={resource.id}
              className="flex items-center justify-between px-4 py-3 border-b border-primary-200 dark:border-primary-800 last:border-b-0"
            >
              {renderResourceItem ? (
                renderResourceItem(resource)
              ) : (
                <div className="flex-1">
                  <Body>{resource.name}</Body>
                  {resource.source && (
                    <Caption className="mt-0.5">{resource.source}</Caption>
                  )}
                </div>
              )}
              <Button
                variant="warning"
                onClick={() => onRemove(resource.id)}
                disabled={loading}
                size="sm"
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex justify-end">
        <Button variant="danger" onClick={onRevoke} disabled={loading}>
          {revokeButtonLabel}
        </Button>
      </div>
    </div>
  );
}
