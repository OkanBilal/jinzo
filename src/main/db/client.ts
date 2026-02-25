import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as schema from "./schema";
import type {
  DatabaseInstance,
  SQLiteInstance,
  DatabaseConfig,
  DatabaseInitResult,
  ExtensionLoadResult,
} from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database client singleton for the Electron app
 */
class DatabaseClient {
  private static instance: DatabaseClient | null = null;
  private db: DatabaseInstance | null = null;
  private sqlite: SQLiteInstance | null = null;
  private dbPath: string | null = null;
  private isInitialized = false;
  private initializePromise: Promise<DatabaseInitResult> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  /**
   * Initialize database with configuration
   */
  async initialize(
    config?: Partial<DatabaseConfig>,
  ): Promise<DatabaseInitResult> {
    if (this.isInitialized && this.db && this.sqlite) {
      console.log("Database already initialized");
      return {
        db: this.db,
        sqlite: this.sqlite,
        extensions: [],
      };
    }

    // Prevent concurrent initialization
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = this.doInitialize(config);
    try {
      return await this.initializePromise;
    } finally {
      this.initializePromise = null;
    }
  }

  private async doInitialize(
    config?: Partial<DatabaseConfig>,
  ): Promise<DatabaseInitResult> {
    // Ensure Electron is ready before using app.getPath()
    if (
      app &&
      app.isReady &&
      typeof app.isReady === "function" &&
      !app.isReady()
    ) {
      await app.whenReady();
    }

    try {
      // Determine database path
      this.dbPath = config?.url || this.getDefaultDatabasePath();

      // Ensure directory exists
      this.ensureDirectoryExists(this.dbPath);

      // Create SQLite instance
      this.sqlite = new Database(this.dbPath, {});

      // Configure database
      this.configureDatabase(config);

      // Create Drizzle instance
      this.db = drizzle(this.sqlite, { schema });

      // Run migrations
      this.runMigrations();

      // Load extensions (if needed)
      const extensions = this.loadExtensions();

      // Seed initial data
      await this.seedInitialData();

      this.isInitialized = true;

      console.log("Database initialized successfully");

      return {
        db: this.db,
        sqlite: this.sqlite,
        extensions,
      };
    } catch (error) {
      console.error("Failed to initialize database:", error);
      await this.close().catch(() => {});
      throw error;
    }
  }

  /**
   * Configure database settings
   */
  private configureDatabase(config?: Partial<DatabaseConfig>): void {
    if (!this.sqlite) return;

    const enableWAL = config?.enableWAL ?? true;
    const busyTimeout = config?.busyTimeout ?? 5000;

    // Enable WAL mode for better concurrency
    if (enableWAL) {
      this.sqlite.pragma("journal_mode = WAL");
    }

    // Set busy timeout
    this.sqlite.pragma(`busy_timeout = ${busyTimeout}`);

    // Enable foreign keys
    this.sqlite.pragma("foreign_keys = ON");

    // Performance optimizations
    this.sqlite.pragma("synchronous = NORMAL");
    this.sqlite.pragma("cache_size = -64000"); // 64MB cache
    this.sqlite.pragma("temp_store = MEMORY");
    this.sqlite.pragma("mmap_size = 268435456"); // 256MB
  }

  /**
   * Run database migrations (sync)
   */
  private runMigrations(): void {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const migrationsFolder = this.getMigrationsFolder();

    if (!migrationsFolder) {
      console.log("No migrations folder resolved, skipping migrations");
      return;
    }

    if (fs.existsSync(migrationsFolder)) {
      console.log("Running migrations...");
      migrate(this.db, { migrationsFolder });
      console.log("Migrations completed");
    } else {
      console.log("No migrations folder found, skipping migrations");
    }
  }

  /**
   * Seed initial data if tables are empty
   */
  private async seedInitialData(): Promise<void> {
    if (!this.db || !this.sqlite) {
      return;
    }

    try {
      // Import seed functions dynamically to avoid circular dependencies
      const { seedAccountsData } = await import("./queries/seed-accounts");
      const { seedProvidersData } = await import("./queries/seed-providers");
      const { seedApps } = await import("./queries/seed-apps");
      const { seedConnections } = await import("./queries/seed-connections");
      const { seedMoodsData } = await import("./queries/seed-moods");

      // Check if any data exists
      const accountsCount = this.sqlite
        .prepare("SELECT COUNT(*) as count FROM accounts")
        .get() as { count: number };
      const providersCount = this.sqlite
        .prepare("SELECT COUNT(*) as count FROM providers")
        .get() as { count: number };
      const appsCount = this.sqlite
        .prepare("SELECT COUNT(*) as count FROM app_states")
        .get() as { count: number };
      const connectionsCount = this.sqlite
        .prepare("SELECT COUNT(*) as count FROM connections")
        .get() as { count: number };

      if (
        accountsCount.count === 0 &&
        providersCount.count === 0 &&
        appsCount.count === 0 &&
        connectionsCount.count === 0
      ) {
        console.log("Seeding initial data...");
        await seedAccountsData(); // MUST be first - referenced by workspaces
        await seedApps();
        await seedConnections();
        await seedProvidersData();
        await seedMoodsData();
        console.log("Initial data seeded successfully");
      } else {
        console.log("Data already exists, skipping seed");
      }
    } catch (error) {
      console.error("Failed to seed initial data:", error);
      // Don't throw - seeding is optional
    }
  }

  /**
   * Resolve migrations folder for dev/prod
   */
  private getMigrationsFolder(): string | null {
    // Try multiple paths in order
    const possiblePaths = [
      // Dev: adjacent to this file (if compiled in place)
      path.join(__dirname, "migrations"),
      // Vite build: .vite/build/db/migrations
      path.join(__dirname, "db", "migrations"),
      // Prod: resources/migrations
      process.resourcesPath
        ? path.join(process.resourcesPath, "migrations")
        : null,
    ].filter(Boolean) as string[];

    for (const migrationPath of possiblePaths) {
      if (fs.existsSync(migrationPath)) {
        return migrationPath;
      }
    }

    console.warn("Migrations folder not found in any expected location");
    console.warn("Checked paths:", possiblePaths);
    return null;
  }

  /**
   * Load SQLite extensions (e.g., sqlite-vec for vector search)
   */
  private loadExtensions(): ExtensionLoadResult[] {
    const results: ExtensionLoadResult[] = [];

    if (!this.sqlite) {
      return results;
    }

    // Load sqlite-vec extension for vector operations
    try {
      // In production, the dylib is unpacked from asar into app.asar.unpacked
      // We need to resolve the path manually since sqlite-vec's index.cjs
      // resolves __dirname inside the asar which doesn't work for native extensions
      if (app.isPackaged) {
        const loadablePath = path.join(
          process.resourcesPath,
          "app.asar.unpacked",
          ".vite",
          "build",
          "node_modules",
          `sqlite-vec-${process.platform}-${process.arch}`,
          "vec0"
        );
        this.sqlite.loadExtension(loadablePath);
      } else {
        const sqliteVec = require("sqlite-vec");
        sqliteVec.load(this.sqlite);
      }
      results.push({
        success: true,
        extensionName: "sqlite-vec",
        message: "Vector extension loaded successfully",
      });
      console.log("sqlite-vec extension loaded successfully");
    } catch (error) {
      console.error("Failed to load sqlite-vec extension:", error);
      results.push({
        success: false,
        extensionName: "sqlite-vec",
        error: error as Error,
        message: "Failed to load vector extension",
      });
    }

    return results;
  }

  /**
   * Get default database path in Electron userData directory
   */
  private getDefaultDatabasePath(): string {
    if (app && !app.isPackaged) {
      return path.join(process.cwd(), ".data", "jinzo.db");
    }
    const userDataPath =
      app?.getPath("userData") || path.join(process.cwd(), ".data");
    return path.join(userDataPath, "jinzo.db");
  }

  /**
   * Ensure directory exists for database file
   */
  private ensureDirectoryExists(filePath: string): void {
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  /**
   * Get Drizzle database instance
   */
  getDb(): DatabaseInstance {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  /**
   * Get raw SQLite instance
   */
  getSqlite(): SQLiteInstance {
    if (!this.sqlite) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.sqlite;
  }

  /**
   * Get database path
   */
  getDbPath(): string | null {
    return this.dbPath;
  }

  /**
   * Check if database is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null && this.sqlite !== null;
  }

  /**
   * Execute a transaction
   */
  transaction<T>(callback: (tx: DatabaseInstance) => T): T {
    const db = this.getDb();
    return db.transaction((tx) => callback(tx));
  }

  /**
   * Create a backup of the database
   */
  async backup(backupPath: string): Promise<void> {
    if (!this.sqlite || !this.dbPath) {
      throw new Error("Database not initialized");
    }

    try {
      this.ensureDirectoryExists(backupPath);

      // Use SQLite backup API for safe backup
      await this.sqlite.backup(backupPath);
    } catch (error) {
      console.error("Backup failed:", error);
      throw error;
    }
  }

  /**
   * Optimize database (vacuum, analyze)
   */
  async optimize(): Promise<void> {
    if (!this.sqlite) {
      throw new Error("Database not initialized");
    }

    try {
      console.log("Optimizing database...");

      // Run VACUUM to reclaim space
      this.sqlite.exec("VACUUM");

      // Run ANALYZE to update statistics
      this.sqlite.exec("ANALYZE");

      // Optimize FTS5 index (merge segments)
      try {
        this.sqlite.exec("INSERT INTO entities_fts(entities_fts) VALUES ('optimize')");
      } catch (e) {
        console.warn("FTS5 optimize skipped:", e);
      }

      console.log("Database optimization completed");
    } catch (error) {
      console.error("Optimization failed:", error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  getStats(): {
    pageCount: number;
    pageSize: number;
    freelistCount: number;
    size: number;
    walSize?: number;
  } {
    if (!this.sqlite || !this.dbPath) {
      throw new Error("Database not initialized");
    }

    const pageCount = this.sqlite.pragma("page_count", {
      simple: true,
    }) as number;
    const pageSize = this.sqlite.pragma("page_size", {
      simple: true,
    }) as number;
    const freelistCount = this.sqlite.pragma("freelist_count", {
      simple: true,
    }) as number;

    const stats = {
      pageCount,
      pageSize,
      freelistCount,
      size: pageCount * pageSize,
    };

    // Check for WAL file
    const walPath = `${this.dbPath}-wal`;
    if (fs.existsSync(walPath)) {
      const walStats = fs.statSync(walPath);
      return { ...stats, walSize: walStats.size };
    }

    return stats;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.sqlite) {
      try {
        // Checkpoint WAL before closing
        this.sqlite.pragma("wal_checkpoint(TRUNCATE)");
        this.sqlite.close();
        console.log("Database connection closed");
      } catch (error) {
        console.error("Error closing database:", error);
      }
    }

    this.cleanup();
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.db = null;
    this.sqlite = null;
    this.dbPath = null;
    this.isInitialized = false;
    this.initializePromise = null;
  }

  /**
   * Reset singleton (mainly for testing)
   */
  static async reset(): Promise<void> {
    if (DatabaseClient.instance) {
      await DatabaseClient.instance.close().catch(() => {});
      DatabaseClient.instance = null;
    }
  }
}

// Export singleton instance getter
export const getDb = () => DatabaseClient.getInstance().getDb();
export const getSqlite = () => DatabaseClient.getInstance().getSqlite();
export const initializeDatabase = (config?: Partial<DatabaseConfig>) =>
  DatabaseClient.getInstance().initialize(config);
export const closeDatabase = () => DatabaseClient.getInstance().close();

export default DatabaseClient;
