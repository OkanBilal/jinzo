import type { MoodPayload, SanitizedMoodResult } from "./mood.dto";

// ─────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────
export function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, maxLength);
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sanitizeMoodPayload(payload: unknown): SanitizedMoodResult {
  if (typeof payload !== "object" || payload === null) {
    return { data: {}, errors: { body: "Invalid payload" } };
  }

  const raw = payload as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const data: Partial<MoodPayload> = {};

  // Name (required)
  const name = sanitizeString(raw.name, 100);
  if (!name || name === "") {
    errors.name = "Name is required";
  } else {
    data.name = name;
  }

  // Slug (optional, will be auto-generated if not provided)
  const slug = sanitizeString(raw.slug, 100);
  if (slug) {
    data.slug = slug;
  }

  // Description (optional)
  const description = sanitizeString(raw.description, 500);
  if (description) {
    data.description = description;
  }

  // System Prompt (optional)
  const systemPrompt = sanitizeString(raw.systemPrompt, 10000);
  if (systemPrompt) {
    data.systemPrompt = systemPrompt;
  }

  // Model (optional)
  const model = sanitizeString(raw.model, 100);
  if (model) {
    data.model = model;
  }

  // Icon (optional)
  const icon = sanitizeString(raw.icon, 50);
  if (icon) {
    data.icon = icon;
  }

  // Theme Config (optional, should be valid JSON)
  if (typeof raw.themeConfig === "string" && raw.themeConfig) {
    try {
      JSON.parse(raw.themeConfig);
      data.themeConfig = raw.themeConfig;
    } catch {
      errors.themeConfig = "Invalid JSON format";
    }
  }

  // UI Config (optional, should be valid JSON)
  if (typeof raw.uiConfig === "string" && raw.uiConfig) {
    try {
      JSON.parse(raw.uiConfig);
      data.uiConfig = raw.uiConfig;
    } catch {
      errors.uiConfig = "Invalid JSON format";
    }
  }

  // Sort Order (optional)
  if (typeof raw.sortOrder === "number") {
    data.sortOrder = raw.sortOrder;
  }

  return { data, errors };
}
