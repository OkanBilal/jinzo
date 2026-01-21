import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { accounts } from "../../db/schema";
import { ACCOUNT_ID, DEFAULT_ACCOUNT_RESPONSE, FIELD_LIMITS } from "./constants";
import type { AccountPayload, SanitizedPayload, AccountRecord } from "./types";

export function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, maxLength);
}

export function isValidEmail(value: string): boolean {
  return value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function sanitizePayload(payload: unknown): {
  data: SanitizedPayload;
  errors: Record<string, string>;
} {
  if (typeof payload !== "object" || payload === null) {
    return { data: {}, errors: { body: "Invalid payload" } };
  }

  const entries = Object.entries(FIELD_LIMITS).reduce<{
    data: SanitizedPayload;
    errors: Record<string, string>;
  }>(
    (acc, [key, limit]) => {
      const sanitized = sanitizeString(
        (payload as Record<string, unknown>)[key],
        limit as number
      );

      if (sanitized !== undefined) {
        if (key === "email" && !isValidEmail(sanitized)) {
          acc.errors.email = "Invalid email";
        } else {
          acc.data[key as keyof AccountPayload] = sanitized;
        }
      }

      return acc;
    },
    { data: {}, errors: {} }
  );

  return entries;
}

export async function ensureAccountRow(): Promise<AccountRecord> {
  const db = getDb();
  const existing = await db.query.accounts.findFirst({
    where: eq(accounts.id, ACCOUNT_ID),
  });

  if (existing) {
    return existing;
  }

  await db
    .insert(accounts)
    .values({ id: ACCOUNT_ID, timezone: "UTC", locale: "en-US" })
    .onConflictDoNothing();

  const created = await db.query.accounts.findFirst({
    where: eq(accounts.id, ACCOUNT_ID),
  });

  if (!created) {
    throw new Error("Failed to initialize account row");
  }

  return created;
}

export function formatResponse(record: AccountRecord | null | undefined) {
  if (!record) {
    return DEFAULT_ACCOUNT_RESPONSE;
  }

  return {
    id: record.id,
    displayName: record.displayName ?? "",
    email: record.email ?? "",
    company: record.company ?? "",
    jobTitle: record.jobTitle ?? "",
    timezone: record.timezone ?? "UTC",
    locale: record.locale ?? "en-US",
    website: record.website ?? "",
    avatarUrl: record.avatarUrl ?? "",
    bio: record.bio ?? "",
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
  };
}
