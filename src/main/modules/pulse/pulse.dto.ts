import type { pulses } from "../../db/schema";

export type Pulse = typeof pulses.$inferSelect;
export type PulseFrequency = Pulse["frequency"];

export type CreatePulseInput = {
  workspaceId: string;
  providerId: string;
  model: string;
  title: string;
  prompt: string;
  frequency: PulseFrequency;
  dayOfWeek?: number | null;
  hour: number;
  minute: number;
  timezone: string;
  thinkingMode?: boolean;
  effortLevel?: string | null;
  isActive?: boolean;
};

export type UpdatePulseInput = Partial<
  Pick<
    Pulse,
    | "workspaceId"
    | "providerId"
    | "model"
    | "title"
    | "prompt"
    | "frequency"
    | "dayOfWeek"
    | "hour"
    | "minute"
    | "timezone"
    | "thinkingMode"
    | "effortLevel"
    | "isActive"
  >
>;

