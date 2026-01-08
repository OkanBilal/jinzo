import { ipcMain } from "electron";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { accounts } from "../db/schema";

const ACCOUNT_ID = "default";

const DEFAULT_ACCOUNT_RESPONSE = {
  id: ACCOUNT_ID,
  displayName: "",
  email: "",
  company: "",
  jobTitle: "",
  timezone: "UTC",
  locale: "en-US",
  website: "",
  avatarUrl: "",
  bio: "",
  createdAt: null as Date | null,
  updatedAt: null as Date | null,
};

const FIELD_LIMITS = {
  displayName: 120,
  email: 160,
  company: 160,
  jobTitle: 120,
  timezone: 80,
  locale: 16,
  website: 200,
  avatarUrl: 300,
  bio: 2000,
} as const;

type AccountPayload = Omit<
  typeof DEFAULT_ACCOUNT_RESPONSE,
  "id" | "createdAt" | "updatedAt"
>;

type SanitizedPayload = Partial<AccountPayload>;

type AccountRecord = typeof accounts.$inferSelect;

function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizePayload(payload: unknown): {
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

async function ensureAccountRow(): Promise<AccountRecord> {
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

function formatResponse(record: AccountRecord | null | undefined) {
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

/**
 * Register all IPC handlers for account operations
 */
export function registerAccountHandlers() {
  // Get account details
  ipcMain.handle("account:get", async () => {
    try {
      const account = await ensureAccountRow();
      return { success: true, data: formatResponse(account) };
    } catch (error) {
      console.error("Failed to fetch account:", error);
      return { success: false, error: "Failed to fetch account" };
    }
  });

  // Update account details
  ipcMain.handle("account:update", async (_, payload: unknown) => {
    try {
      const { data, errors } = sanitizePayload(payload);

      if (Object.keys(errors).length > 0) {
        return { success: false, errors };
      }

      if (Object.keys(data).length === 0) {
        return { success: false, error: "No fields to update" };
      }

      await ensureAccountRow();

      const db = getDb();
      await db
        .update(accounts)
        .set({
          ...data,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(accounts.id, ACCOUNT_ID));

      const updated = await db.query.accounts.findFirst({
        where: eq(accounts.id, ACCOUNT_ID),
      });

      return { success: true, data: formatResponse(updated) };
    } catch (error) {
      console.error("Failed to update account:", error);
      return { success: false, error: "Failed to update account" };
    }
  });
}
