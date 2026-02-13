import { Button } from "@/components/ui/button";
import { Body } from "@/components/ui/text";
import { useGetProviderByIdQuery } from "@/lib/redux/api";
import type { StructuredOutputEntry } from "../../../../main/modules/providers/adapters/adapter.types";

interface StructuredOutputProps {
  onEditClick: () => void;
}

export function StructuredOutput({
  onEditClick,
}: StructuredOutputProps) {
  const { data: provider } = useGetProviderByIdQuery("ollama");
  const config = (provider?.config ?? {}) as Record<string, unknown>;

  const entries = (config.structuredOutputs ?? {}) as Record<
    string,
    StructuredOutputEntry
  >;
  const selectedId =
    (config.structuredOutputsSelectedId as string | null) ?? null;
  const selectedSchema = selectedId ? entries[selectedId] : null;
  const selectedSchemaName = selectedSchema?.name ?? "Off";

  return (
    <div className="flex items-center justify-between py-1 mt-2">
      <div className="flex flex-col">
        <Body className="text-sm text-primary-900 dark:text-primary!">
          Structured Outputs
        </Body>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-primary-500 dark:text-primary-200">
          {selectedSchemaName}
        </span>
        <Button
          onClick={onEditClick}
          className="px-2.5 py-1 text-xs font-medium text-primary-900 dark:text-primary bg-primary-950/4 dark:bg-primary/6 rounded-lg hover:bg-primary-950/6 dark:hover:bg-primary/8 transition-colors"
        >
          Edit
        </Button>
      </div>
    </div>
  );
}
