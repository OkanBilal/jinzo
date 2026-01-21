import { appSettings } from "../../db/schema";

export type AppSettingsRecord = typeof appSettings.$inferSelect;
