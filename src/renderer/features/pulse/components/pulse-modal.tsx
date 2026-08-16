import { useMemo } from "react";
import {
  Button,
  Input,
  Textarea,
  WizardModal,
  toast,
  useWizard,
  type WizardStep,
} from "@/components/ui";
import { useGetAccountQuery } from "@/lib/redux/api/accountApi";
import {
  useCreatePulseMutation,
  useUpdatePulseMutation,
  type Pulse,
} from "@/lib/redux/api/pulseApi";
import {
  applyTemplate,
  EMPTY_PULSE_FORM,
  formToCreateInput,
  isPulseFormValid,
  pulseToForm,
  type PulseFormState,
} from "../hooks/use-pulse-form";
import {
  ModelPicker,
  ProviderPicker,
  PulseEffortPicker,
  SchedulePicker,
  WorkspacePicker,
} from "./pulse-pickers";
import type { PulseTemplate } from "../templates";
import { Sun } from "@/components/ui/icons";

type PulseWizardData = PulseFormState;

interface PulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  pulse?: Pulse | null;
  initialTemplate?: PulseTemplate | null;
}

function buildInitialData(
  pulse?: Pulse | null,
  template?: PulseTemplate | null,
): PulseWizardData {
  if (pulse) return pulseToForm(pulse);
  if (template) return applyTemplate({ ...EMPTY_PULSE_FORM }, template);
  return { ...EMPTY_PULSE_FORM };
}

// ─────────────────────────────────────────────────────────────
// Single-step body: title + prompt textarea + bottom toolbar + footer
// ─────────────────────────────────────────────────────────────

function PulseStep({ isEditing }: { isEditing: boolean }) {
  const ctx = useWizard<PulseWizardData>();
  const { data, setData } = ctx;

  const canSubmit = isPulseFormValid(data);

  return (
    <div className="-m-2">
      {/* Title */}
      <Input
        variant="bare"
        type="text"
        value={data.title}
        onChange={(e) => setData({ title: e.target.value })}
        placeholder="Automation title"
        aria-label="Automation title"
        className="w-full bg-transparent outline-none  text-primary-900 dark:text-primary-100 placeholder-primary-500 mb-3"
      />

      {/* Selection pills */}
      <div className="flex items-center -mx-2 flex-wrap mb-3">
        <WorkspacePicker
          value={data.workspaceId}
          onChange={(id) => setData({ workspaceId: id })}
        />
        <SchedulePicker
          frequency={data.frequency}
          hour={data.hour}
          minute={data.minute}
          dayOfWeek={data.dayOfWeek}
          onChange={(next) =>
            setData({
              frequency: next.frequency,
              hour: next.hour,
              minute: next.minute,
              dayOfWeek: next.dayOfWeek,
            })
          }
        />
        <ProviderPicker
          value={data.providerId}
          onChange={(id) =>
            setData({
              providerId: id,
              model: "",
              thinkingMode: false,
              effortLevel: "",
            })
          }
        />
        <ModelPicker
          providerId={data.providerId}
          value={data.model}
          onChange={(id) =>
            setData({ model: id, thinkingMode: false, effortLevel: "" })
          }
        />
        <PulseEffortPicker
          providerId={data.providerId}
          modelId={data.model}
          thinkingMode={data.thinkingMode}
          effortLevel={data.effortLevel}
          onChange={(next) =>
            setData({
              thinkingMode: next.thinkingMode,
              effortLevel: next.effortLevel,
            })
          }
        />
      </div>

      {/* Divider */}

      {/* Prompt / description */}
      <Textarea
        variant="bare"
        value={data.prompt}
        onChange={(e) => setData({ prompt: e.target.value })}
        placeholder="Add prompt e.g. look for crashes in $sentry"
        aria-label="Automation prompt"
        className="w-full h-64 py-4 bg-transparent outline-none resize-none text-sm text-primary-900 dark:text-primary-100 placeholder-primary-400 dark:placeholder-primary-700"
      />

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 pt-3">
        <Button
          type="button"
          onClick={ctx.close}
          disabled={ctx.isSubmitting}
          variant="ghost"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="submit"
          onClick={ctx.goNext}
          disabled={!canSubmit || ctx.isSubmitting}
        >
          {ctx.isSubmitting ? "Saving…" : isEditing ? "Save" : "Create"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────

export function PulseModal({
  isOpen,
  onClose,
  pulse,
  initialTemplate,
}: PulseModalProps) {
  const { data: account } = useGetAccountQuery();
  const [createPulse] = useCreatePulseMutation();
  const [updatePulse] = useUpdatePulseMutation();
  const isEditing = !!pulse;

  // Remount the wizard when target identity changes so initialData is honored.
  const wizardKey = pulse?.id ?? initialTemplate?.id ?? "new";

  const initialData = useMemo(
    () => buildInitialData(pulse, initialTemplate),
    [pulse, initialTemplate],
  );

  const steps: WizardStep<PulseWizardData>[] = useMemo(
    () => [
      {
        id: "pulse",
        title: isEditing ? "Edit automation" : "New pulse",
        titleIcon: <Sun className="size-5.5! text-primary-900 dark:text-primary-100" />,
        render: () => <PulseStep isEditing={isEditing} />,
      },
    ],
    [isEditing],
  );

  const handleComplete = async (data: PulseWizardData) => {
    if (!account?.id) return;
    const input = formToCreateInput(data);
    if (pulse) {
      await updatePulse({ id: pulse.id, input }).unwrap();
      toast.success("Pulse updated");
    } else {
      await createPulse({ accountId: account.id, input }).unwrap();
      toast.success("Pulse created");
    }
    onClose();
  };

  return (
    <WizardModal<PulseWizardData>
      key={wizardKey}
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      steps={steps}
      initialData={initialData}
      onComplete={handleComplete}
      className="max-w-4xl"
    />
  );
}
