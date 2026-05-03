import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "@/components/ui/icons";
import { useGetPulsesQuery, type Pulse } from "@/lib/redux/api/pulseApi";
import { PulseList } from "@/features/pulse/components/pulse-list";
import { PulseModal } from "@/features/pulse/components/pulse-modal";
import { PulseTemplates } from "@/features/pulse/components/pulse-templates";
import type { PulseTemplate } from "@/features/pulse/templates";
import { Heading2 } from "@/components/ui";

export default function PulsePage() {
  const { data: pulses = [] } = useGetPulsesQuery();
  const [editingPulse, setEditingPulse] = useState<Pulse | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<PulseTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openCreate = () => {
    setEditingPulse(null);
    setActiveTemplate(null);
    setModalOpen(true);
  };

  const openTemplate = (tpl: PulseTemplate) => {
    setEditingPulse(null);
    setActiveTemplate(tpl);
    setModalOpen(true);
  };

  const openEdit = (pulse: Pulse) => {
    setEditingPulse(pulse);
    setActiveTemplate(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPulse(null);
    setActiveTemplate(null);
  };

  return (
    <div className="h-full max-w-240 mx-auto px-2 py-16  overflow-y-auto noscrollbar bg-primary dark:bg-primary-950">
      <header className="flex items-start justify-between mb-8">
        <div>
          <Heading2 >
            Pulse
          </Heading2>
          <p className="text-sm text-primary-500 mt-1">
          Pulse keeps your work in motion with scheduled, automated runs.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={openCreate}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="size-4" />
          New Pulse
        </Button>
      </header>

      {pulses.length > 0 && (
        <div className="mb-10">
          <PulseList onEdit={openEdit} />
        </div>
      )}

      <PulseTemplates onSelect={openTemplate} />

      <PulseModal
        isOpen={modalOpen}
        onClose={closeModal}
        pulse={editingPulse}
        initialTemplate={activeTemplate}
      />
    </div>
  );
}
