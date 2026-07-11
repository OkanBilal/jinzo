import type { SpacePayload, SanitizedSpaceResult } from "./space.dto";
import { isProviderId } from "../../../shared/provider-ids";

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

export function sanitizeSpacePayload(payload: unknown): SanitizedSpaceResult {
  if (typeof payload !== "object" || payload === null) {
    return { data: {}, errors: { body: "Invalid payload" } };
  }

  const raw = payload as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const data: Partial<SpacePayload> = {};

  // Name: required only when explicitly sent (create always sends it; partial updates can omit)
  if (Object.prototype.hasOwnProperty.call(raw, "name")) {
    const name = sanitizeString(raw.name, 100);
    if (!name || name === "") {
      errors.name = "Name is required";
    } else {
      data.name = name;
    }
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

  // UI Config (optional, should be valid JSON). providerId is the load-bearing
  // provider selector for the /code route — reject unknown ids here instead of
  // letting the renderer silently fall back to claude on a typo.
  if (typeof raw.uiConfig === "string" && raw.uiConfig) {
    try {
      const parsed: unknown = JSON.parse(raw.uiConfig);
      const providerId =
        typeof parsed === "object" && parsed !== null
          ? (parsed as Record<string, unknown>).providerId
          : undefined;
      if (providerId !== undefined && !isProviderId(providerId)) {
        errors.uiConfig = `Unknown providerId "${String(providerId)}"`;
      } else {
        data.uiConfig = raw.uiConfig;
      }
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
