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
  async initialize(config?: Partial<DatabaseConfig>): Promise<DatabaseInitResult> {
    if (this.isInitialized && this.db && this.sqlite) {
      console.log("Database already initialized");
      console.log("Runtime DB:", DatabaseClient.getInstance().getDbPath());
      return {
        db: this.db,
        sqlite: this.sqlite,
        extensions: [],
      };
    }

    // Ensure Electron is ready before using app.getPath()
    if (app && app.isReady && typeof app.isReady === 'function' && !app.isReady()) {
      await app.whenReady();
    }

    try {
      // Determine database path
      this.dbPath = config?.url || this.getDefaultDatabasePath();
      
      // Ensure directory exists
      this.ensureDirectoryExists(this.dbPath);

      console.log(`Initializing database at: ${this.dbPath}`);

      // Create SQLite instance
      this.sqlite = new Database(this.dbPath, {
        verbose: config?.verbose ? console.log : undefined,
      });

      // Configure database
      this.configureDatabase(config);

      // Create Drizzle instance
      this.db = drizzle(this.sqlite, { schema });

      // Run migrations
      this.runMigrations();

      // Load extensions (if needed)
      const extensions = this.loadExtensions();

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
    this.sqlite.pragma("mmap_size = 30000000000"); // 30GB
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
   * Resolve migrations folder for dev/prod
   */
  private getMigrationsFolder(): string | null {
    // In dev, migrations are in src/main/db/migrations
    // After build, they'll be in .vite/build/db/migrations
    const devPath = path.join(__dirname, "migrations");
    if (fs.existsSync(devPath)) return devPath;

    // Try relative to current file location for build output
    const buildPath = path.join(__dirname, "..", "db", "migrations");
    if (fs.existsSync(buildPath)) return buildPath;

    // Prod: migrations under resources/migrations during packaging
    if (process.resourcesPath) {
      const prodPath = path.join(process.resourcesPath, "migrations");
      if (fs.existsSync(prodPath)) return prodPath;
    }

    console.warn("Migrations folder not found in any expected location");
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

    // Example: Load sqlite-vec extension for vector operations
    // Uncomment when you have the extension available
    /*
    try {
      const vecExtPath = this.getExtensionPath("sqlite-vec");
      if (vecExtPath && fs.existsSync(vecExtPath)) {
        this.sqlite.loadExtension(vecExtPath);
        results.push({
          success: true,
          extensionName: "sqlite-vec",
          message: "Vector extension loaded successfully",
        });
      }
    } catch (error) {
      results.push({
        success: false,
        extensionName: "sqlite-vec",
        error: error as Error,
        message: "Failed to load vector extension",
      });
    }
    */

    return results;
  }

  /**
   * Get extension path based on platform
   * @private Reserved for future extension loading
   */
  private getExtensionPath(extensionName: string): string | null {
    const platform = process.platform;
    const arch = process.arch;
    
    // Adjust based on your extension location
    const extensionsDir = path.join(app?.getAppPath() || process.cwd(), "extensions");
    
    let extensionFile: string;
    if (platform === "darwin") {
      extensionFile = `${extensionName}-darwin-${arch}.dylib`;
    } else if (platform === "linux") {
      extensionFile = `${extensionName}-linux-${arch}.so`;
    } else if (platform === "win32") {
      extensionFile = `${extensionName}-win32-${arch}.dll`;
    } else {
      return null;
    }

    return path.join(extensionsDir, extensionFile);
  }

  /**
   * Get default database path in Electron userData directory
   */
  private getDefaultDatabasePath(): string {
    const userDataPath = app?.getPath("userData") || path.join(process.cwd(), ".data");
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

      console.log(`Database backed up to: ${backupPath}`);
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

    const pageCount = this.sqlite.pragma("page_count", { simple: true }) as number;
    const pageSize = this.sqlite.pragma("page_size", { simple: true }) as number;
    const freelistCount = this.sqlite.pragma("freelist_count", { simple: true }) as number;

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
