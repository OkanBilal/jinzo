import { Muted, ErrorText, BodyMedium } from "../../../../../components/ui/text";
import { Button } from "../../../../../components/ui/button";
import { Checkbox } from "../../../../../components/ui/checkbox";

interface SelectableResource {
  id: string | number;
  [key: string]: any;
}

interface SelectResourcesStepProps<T extends SelectableResource> {
  resources: T[];
  selectedResources: Set<string | number> | string[] | number[];
  onToggleResource: (id: string | number) => void;
  onSave: () => void;
  onBack: () => void;
  loading: boolean;
  error: string;
  title?: string;
  emptyMessage?: string;
  saveButtonLabel?: string;
  renderResourceItem: (resource: T) => React.ReactNode;
}

export function SelectResourcesStep<T extends SelectableResource>({
  resources,
  selectedResources,
  onToggleResource,
  onSave,
  onBack,
  loading,
  error,
  title,
  emptyMessage = "No resources available.",
  saveButtonLabel,
  renderResourceItem,
}: SelectResourcesStepProps<T>) {
  const selectedCount =
    selectedResources instanceof Set
      ? selectedResources.size
      : selectedResources.length;

  const isSelected = (id: string | number) =>
    selectedResources instanceof Set
      ? selectedResources.has(id)
      : (selectedResources as any[]).includes(id);

  const finalSaveLabel =
    saveButtonLabel ||
    `Save ${selectedCount} ${selectedCount === 1 ? "Resource" : "Resources"}`;

  return (
    <div className="space-y-4">
      {title && <Muted>{title}</Muted>}
      {!title && (
        <Muted>
          <span className="mr-1 font-semibold dark:text-primary-50 text-primary-950">
            {selectedCount}
          </span>
          selected.
        </Muted>
      )}

      <div className="max-h-52 overflow-y-auto border border-primary-200 dark:border-primary-800 rounded-xl">
        {resources.length === 0 ? (
          <div className="p-8 text-center text-primary-500 dark:text-primary-400">
            <BodyMedium>{emptyMessage}</BodyMedium>
          </div>
        ) : (
          resources.map((resource) => {
            const selected = isSelected(resource.id);
            return (
              <div
                key={resource.id}
                className="flex items-center justify-between px-4 py-4 border-b border-primary-200 dark:border-primary-800 last:border-b-0"
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => onToggleResource(resource.id)}
                >
                  {renderResourceItem(resource)}
                </div>
                <Checkbox
                  checked={selected}
                  onChange={() => onToggleResource(resource.id)}
                  disabled={loading}
                />
              </div>
            );
          })
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex justify-between gap-3 pt-2">
        <Button variant="link" onClick={onBack} disabled={loading} className="px-1">
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          disabled={loading || selectedCount === 0}
          isLoading={loading}
          className="ml-auto"
        >
          {loading ? "Saving..." : finalSaveLabel}
        </Button>
      </div>
    </div>
  );
}
