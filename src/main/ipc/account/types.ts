import { accounts } from "../../db/schema";
import { DEFAULT_ACCOUNT_RESPONSE } from "./constants";

export type AccountPayload = Omit<
  typeof DEFAULT_ACCOUNT_RESPONSE,
  "id" | "createdAt" | "updatedAt"
>;

export type SanitizedPayload = Partial<AccountPayload>;

export type AccountRecord = typeof accounts.$inferSelect;
