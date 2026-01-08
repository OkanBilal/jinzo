import type * as schema from "./schema";

import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
 
export type DatabaseInstance = BetterSQLite3Database<typeof schema>;

export type SQLiteInstance = Database.Database;
export interface SqliteVecModule {
  load: (db: Database.Database) => void;
}

export interface DatabaseConfig {
  url: string;
  verbose?: boolean;
  enableWAL?: boolean;
  busyTimeout?: number;
}

export interface ExtensionLoadResult {
  success: boolean;
  extensionName: string;
  error?: Error;
  message?: string;
}

export interface DatabaseInitResult {
  db: DatabaseInstance;
  sqlite: SQLiteInstance;
  extensions: ExtensionLoadResult[];
}

export const DEFAULT_DATABASE_CONFIG: Partial<DatabaseConfig> = {
  verbose: false,
  enableWAL: true,
  busyTimeout: 5000,
} as const;

export const VECTOR_EXTENSION_NAMES = {
  SQLITE_VEC: "sqlite-vec",
  SQLITE_VEC_DARWIN: "sqlite-vec-darwin-arm64",
} as const;

export type VectorExtensionName = typeof VECTOR_EXTENSION_NAMES[keyof typeof VECTOR_EXTENSION_NAMES];
