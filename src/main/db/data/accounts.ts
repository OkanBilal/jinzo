import type { InferInsertModel } from "drizzle-orm";
import { accounts } from "../schema";

// ─────────────────────────────────────────────────────────────
// Default Account Seed Data
// ─────────────────────────────────────────────────────────────

type CreateAccountPayload = InferInsertModel<typeof accounts>;

export const seedAccounts: CreateAccountPayload[] = [
  {
    id: "default",
    displayName: "OkanBilal",
    email: "obbalci@gmail.com",
    company: null,
    jobTitle: null,
    timezone: "UTC",
    locale: "en-US",
    website: null,
    avatarUrl: "https://okanbilal.com/_next/image?url=/profile_fuji.jpg&w=384&q=75",
    bio: null,
  },
];
