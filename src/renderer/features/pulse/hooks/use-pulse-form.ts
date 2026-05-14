import { useCallback, useMemo, useState } from "react";
import type {
  CreatePulseInput,
  Pulse,
  PulseFrequency,
} from "@/lib/redux/api/pulseApi";
import type { PulseTemplate } from "../templates";

export interface PulseFormState {
  title: string;
  prompt: string;
  workspaceId: string;
  providerId: string;
  model: string;
  frequency: PulseFrequency;
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  thinkingMode: boolean;
  effortLevel: string;
}

const getLocalTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

export const EMPTY_PULSE_FORM: PulseFormState = {
  title: "",
  prompt: "",
  workspaceId: "",
  providerId: "",
  model: "",
  frequency: "daily",
  hour: 9,
  minute: 0,
  dayOfWeek: null,
  thinkingMode: false,
  effortLevel: "",
};

export function pulseToForm(pulse: Pulse): PulseFormState {
  return {
    title: pulse.title,
    prompt: pulse.prompt,
    workspaceId: pulse.workspaceId,
    providerId: pulse.providerId,
    model: pulse.model,
    frequency: pulse.frequency,
    hour: pulse.hour,
    minute: pulse.minute,
    dayOfWeek: pulse.dayOfWeek,
    thinkingMode: pulse.thinkingMode,
    effortLevel: pulse.effortLevel ?? "",
  };
}

export function applyTemplate(
  form: PulseFormState,
  template: PulseTemplate,
): PulseFormState {
  return {
    ...form,
    title: template.title,
    prompt: template.prompt,
    frequency: template.defaultFrequency,
    hour: template.defaultHour,
    minute: template.defaultMinute,
    dayOfWeek:
      template.defaultFrequency === "weekly"
        ? template.defaultDayOfWeek ?? 1
        : null,
  };
}

export function formToCreateInput(form: PulseFormState): CreatePulseInput {
  return {
    title: form.title.trim(),
    prompt: form.prompt.trim(),
    workspaceId: form.workspaceId,
    providerId: form.providerId,
    model: form.model,
    frequency: form.frequency,
    hour: form.hour,
    minute: form.minute,
    dayOfWeek: form.frequency === "weekly" ? form.dayOfWeek ?? 1 : null,
    thinkingMode: form.thinkingMode,
    effortLevel: form.effortLevel || null,
    timezone: getLocalTimezone(),
    isActive: true,
  };
}

export function usePulseForm(initial?: Pulse | null) {
  const [form, setForm] = useState<PulseFormState>(() =>
    initial ? pulseToForm(initial) : { ...EMPTY_PULSE_FORM },
  );

  const update = useCallback(<K extends keyof PulseFormState>(
    key: K,
    value: PulseFormState[K],
  ) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Reset dayOfWeek when leaving weekly; default to Monday entering weekly
      if (key === "frequency") {
        if (value === "weekly" && next.dayOfWeek == null) next.dayOfWeek = 1;
        if (value !== "weekly") next.dayOfWeek = null;
      }
      // Reset effort when provider changes
      if (key === "providerId") {
        next.model = "";
        next.thinkingMode = false;
        next.effortLevel = "";
      }
      // Clear effort when model changes
      if (key === "model") {
        next.thinkingMode = false;
        next.effortLevel = "";
      }
      return next;
    });
  }, []);

  const reset = useCallback((next?: Pulse | null) => {
    setForm(next ? pulseToForm(next) : { ...EMPTY_PULSE_FORM });
  }, []);

  const isValid = useMemo(
    () =>
      form.title.trim().length > 0 &&
      form.prompt.trim().length > 0 &&
      !!form.workspaceId &&
      !!form.providerId &&
      !!form.model,
    [form],
  );

  return { form, setForm, update, reset, isValid };
}
