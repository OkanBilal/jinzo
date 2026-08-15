import { useId } from "react";
import { Body, Button, Checkbox, ErrorText, Muted, Text } from "@/components/ui";

interface SelectableResource {
  id: string | number;
  [key: string]: any;
}

function ResourceRow<T extends SelectableResource>({
  resource,
  selected,
  onToggle,
  renderItem,
  loading,
}: {
  resource: T;
  selected: boolean;
  onToggle: (id: string | number) => void;
  renderItem: (resource: T) => React.ReactNode;
  loading: boolean;
}) {
  const content = renderItem(resource);
  const resourceLabelId = useId();

  return (
    <div className="flex items-center dark:bg-primary-950/50 bg-primary  justify-between px-4 py-3.5 border-b border-primary-200/50 dark:border-primary-800/40 last:border-b-0">
      <Button
        id={resourceLabelId}
        className="flex-1 text-left cursor-pointer"
        onClick={() => onToggle(resource.id)}
      >
        {content}
      </Button>
      <Checkbox
        checked={selected}
        onChange={() => onToggle(resource.id)}
        disabled={loading}
        aria-labelledby={resourceLabelId}
      />
    </div>
  );
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
          <Text
            as="span"
            size="inherit"
            tone="contrast"
            weight="semibold"
            className="mr-1"
          >
            {selectedCount}
          </Text>
          selected.
        </Muted>
      )}

      <div className="max-h-52 overflow-y-auto border border-primary-200/50 dark:border-primary-800/40 rounded-xl">
        {resources.length === 0 ? (
          <div className="p-8 text-center">
            <Body>{emptyMessage}</Body>
          </div>
        ) : (
          resources.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              selected={isSelected(resource.id)}
              onToggle={onToggleResource}
              renderItem={renderResourceItem}
              loading={loading}
            />
          ))
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex justify-between gap-3 pt-2">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button
          variant="submit"
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
