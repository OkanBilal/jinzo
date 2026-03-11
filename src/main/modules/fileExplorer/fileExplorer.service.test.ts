import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { fileExplorerService } from "./fileExplorer.service";

let tmpDir: string;

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "jinzo-fe-test-"));
}

describe("fileExplorerService", () => {
  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ─────────────────────────────────────────────────────────────
  // readDirectory
  // ─────────────────────────────────────────────────────────────
  describe("readDirectory", () => {
    it("reads empty directory", async () => {
      const result = await fileExplorerService.readDirectory({ rootPath: tmpDir });
      expect(result.success).toBe(true);
      expect(result.data!.totalFiles).toBe(0);
      expect(result.data!.totalDirectories).toBe(0);
      expect(result.data!.root.children).toEqual([]);
    });

    it("reads files and directories", async () => {
      await fs.mkdir(path.join(tmpDir, "src"));
      await fs.writeFile(path.join(tmpDir, "src", "index.ts"), "export {}");
      await fs.writeFile(path.join(tmpDir, "readme.txt"), "hello");

      const result = await fileExplorerService.readDirectory({ rootPath: tmpDir });
      expect(result.success).toBe(true);
      expect(result.data!.totalFiles).toBe(2);
      expect(result.data!.totalDirectories).toBe(1);
      // Directories first, then files
      expect(result.data!.root.children![0].type).toBe("directory");
      expect(result.data!.root.children![0].name).toBe("src");
    });

    it("respects depth limit", async () => {
      await fs.mkdir(path.join(tmpDir, "a"));
      await fs.mkdir(path.join(tmpDir, "a", "b"));
      await fs.writeFile(path.join(tmpDir, "a", "b", "deep.txt"), "deep");

      const result = await fileExplorerService.readDirectory({ rootPath: tmpDir, depth: 1 });
      expect(result.success).toBe(true);
      // depth=1 means only read the root level
      const dirA = result.data!.root.children!.find((c) => c.name === "a");
      expect(dirA).toBeDefined();
      expect(dirA!.children).toEqual([]); // depth limit prevents reading children
    });

    it("excludes hidden files by default", async () => {
      await fs.writeFile(path.join(tmpDir, ".hidden"), "secret");
      await fs.writeFile(path.join(tmpDir, "visible.txt"), "hi");

      const result = await fileExplorerService.readDirectory({ rootPath: tmpDir });
      expect(result.success).toBe(true);
      expect(result.data!.totalFiles).toBe(1);
      expect(result.data!.root.children![0].name).toBe("visible.txt");
    });

    it("includes hidden files when requested", async () => {
      await fs.writeFile(path.join(tmpDir, ".hidden"), "secret");
      await fs.writeFile(path.join(tmpDir, "visible.txt"), "hi");

      const result = await fileExplorerService.readDirectory({
        rootPath: tmpDir,
        includeHidden: true,
        excludePatterns: [],
      });
      expect(result.success).toBe(true);
      expect(result.data!.totalFiles).toBe(2);
    });

    it("applies exclude patterns", async () => {
      await fs.writeFile(path.join(tmpDir, "app.ts"), "code");
      await fs.writeFile(path.join(tmpDir, "app.log"), "logs");

      const result = await fileExplorerService.readDirectory({
        rootPath: tmpDir,
        includeHidden: true,
        excludePatterns: ["*.log"],
      });
      expect(result.success).toBe(true);
      expect(result.data!.totalFiles).toBe(1);
      expect(result.data!.root.children![0].name).toBe("app.ts");
    });

    it("returns error for non-existent path", async () => {
      const result = await fileExplorerService.readDirectory({
        rootPath: path.join(tmpDir, "nope"),
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Directory does not exist");
    });

    it("returns error when path is a file", async () => {
      const filePath = path.join(tmpDir, "file.txt");
      await fs.writeFile(filePath, "hi");

      const result = await fileExplorerService.readDirectory({ rootPath: filePath });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Path is not a directory");
    });

    it("includes file extension and size", async () => {
      await fs.writeFile(path.join(tmpDir, "test.ts"), "const x = 1;");

      const result = await fileExplorerService.readDirectory({ rootPath: tmpDir });
      const file = result.data!.root.children![0];
      expect(file.extension).toBe("ts");
      expect(file.size).toBeGreaterThan(0);
      expect(file.modifiedAt).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // readDirectoryShallow
  // ─────────────────────────────────────────────────────────────
  describe("readDirectoryShallow", () => {
    it("reads single level", async () => {
      await fs.mkdir(path.join(tmpDir, "sub"));
      await fs.writeFile(path.join(tmpDir, "sub", "nested.txt"), "n");
      await fs.writeFile(path.join(tmpDir, "top.txt"), "t");

      const result = await fileExplorerService.readDirectoryShallow(tmpDir);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);

      const dir = result.data!.find((e) => e.name === "sub");
      expect(dir!.type).toBe("directory");
      // has children since sub has nested.txt (but we need includeHidden and no exclude)
    });

    it("returns error for non-directory", async () => {
      const filePath = path.join(tmpDir, "f.txt");
      await fs.writeFile(filePath, "x");

      const result = await fileExplorerService.readDirectoryShallow(filePath);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Path is not a directory");
    });

    it("returns error for non-existent path", async () => {
      const result = await fileExplorerService.readDirectoryShallow(
        path.join(tmpDir, "nope")
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Directory does not exist");
    });

    it("sets hasChildren correctly for directories", async () => {
      await fs.mkdir(path.join(tmpDir, "empty-dir"));
      await fs.mkdir(path.join(tmpDir, "full-dir"));
      await fs.writeFile(path.join(tmpDir, "full-dir", "child.txt"), "c");

      const result = await fileExplorerService.readDirectoryShallow(tmpDir, {
        includeHidden: true,
        excludePatterns: [],
      });
      expect(result.success).toBe(true);

      const emptyDir = result.data!.find((e) => e.name === "empty-dir");
      const fullDir = result.data!.find((e) => e.name === "full-dir");
      expect(emptyDir!.children).toBeUndefined(); // no children marker
      expect(fullDir!.children).toEqual([]); // has children (empty array = expandable)
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getPathInfo
  // ─────────────────────────────────────────────────────────────
  describe("getPathInfo", () => {
    it("returns info for directory", async () => {
      const result = await fileExplorerService.getPathInfo(tmpDir);
      expect(result.success).toBe(true);
      expect(result.data!.exists).toBe(true);
      expect(result.data!.isDirectory).toBe(true);
      expect(result.data!.isFile).toBe(false);
    });

    it("returns info for file", async () => {
      const filePath = path.join(tmpDir, "test.txt");
      await fs.writeFile(filePath, "hello");

      const result = await fileExplorerService.getPathInfo(filePath);
      expect(result.success).toBe(true);
      expect(result.data!.exists).toBe(true);
      expect(result.data!.isFile).toBe(true);
      expect(result.data!.isDirectory).toBe(false);
    });

    it("returns exists=false for non-existent path", async () => {
      const result = await fileExplorerService.getPathInfo(
        path.join(tmpDir, "nope")
      );
      expect(result.success).toBe(true);
      expect(result.data!.exists).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // readFile
  // ─────────────────────────────────────────────────────────────
  describe("readFile", () => {
    it("reads file content", async () => {
      const filePath = path.join(tmpDir, "hello.txt");
      await fs.writeFile(filePath, "hello world");

      const result = await fileExplorerService.readFile(filePath);
      expect(result.success).toBe(true);
      expect(result.data).toBe("hello world");
    });

    it("returns error for non-existent file", async () => {
      const result = await fileExplorerService.readFile(
        path.join(tmpDir, "nope.txt")
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("File does not exist");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // readFileText (SECURITY TESTS)
  // ─────────────────────────────────────────────────────────────
  describe("readFileText", () => {
    it("reads a valid file within workspace", async () => {
      const filePath = path.join(tmpDir, "code.ts");
      await fs.writeFile(filePath, "const x = 1;");

      const result = await fileExplorerService.readFileText({
        filePath,
        workspaceRoot: tmpDir,
      });
      expect(result.success).toBe(true);
      expect(result.data!.content).toBe("const x = 1;");
      expect(result.data!.isBinary).toBe(false);
      expect(result.data!.encoding).toBe("utf-8");
      expect(result.data!.size).toBeGreaterThan(0);
    });

    // ── Path traversal prevention ──
    it("blocks path traversal with ../", async () => {
      // Create a file outside the workspace
      const outsideDir = await makeTmpDir();
      await fs.writeFile(path.join(outsideDir, "secret.txt"), "secret");

      const result = await fileExplorerService.readFileText({
        filePath: path.join(tmpDir, "..", path.basename(outsideDir), "secret.txt"),
        workspaceRoot: tmpDir,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Access denied: path is outside workspace");

      await fs.rm(outsideDir, { recursive: true, force: true });
    });

    it("blocks absolute path outside workspace", async () => {
      const result = await fileExplorerService.readFileText({
        filePath: "/etc/passwd",
        workspaceRoot: tmpDir,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Access denied: path is outside workspace");
    });

    // ── Symlink escape prevention ──
    it("blocks symlink that escapes workspace", async () => {
      const outsideDir = await makeTmpDir();
      const outsideFile = path.join(outsideDir, "secret.txt");
      await fs.writeFile(outsideFile, "secret data");

      const symlinkPath = path.join(tmpDir, "escape-link");
      await fs.symlink(outsideFile, symlinkPath);

      const result = await fileExplorerService.readFileText({
        filePath: symlinkPath,
        workspaceRoot: tmpDir,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Access denied: symlink points outside workspace");

      await fs.rm(outsideDir, { recursive: true, force: true });
    });

    it("allows symlink within workspace", async () => {
      const realFile = path.join(tmpDir, "real.txt");
      await fs.writeFile(realFile, "real content");

      const symlinkPath = path.join(tmpDir, "link.txt");
      await fs.symlink(realFile, symlinkPath);

      const result = await fileExplorerService.readFileText({
        filePath: symlinkPath,
        workspaceRoot: tmpDir,
      });
      expect(result.success).toBe(true);
      expect(result.data!.content).toBe("real content");
    });

    // ── File size limits ──
    it("blocks files exceeding size limit", async () => {
      const filePath = path.join(tmpDir, "big.txt");
      // Create a file bigger than custom limit
      await fs.writeFile(filePath, "x".repeat(1024));

      const result = await fileExplorerService.readFileText({
        filePath,
        workspaceRoot: tmpDir,
        maxSizeBytes: 512,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("File too large");
    });

    it("allows files within size limit", async () => {
      const filePath = path.join(tmpDir, "small.txt");
      await fs.writeFile(filePath, "small");

      const result = await fileExplorerService.readFileText({
        filePath,
        workspaceRoot: tmpDir,
        maxSizeBytes: 1024,
      });
      expect(result.success).toBe(true);
      expect(result.data!.content).toBe("small");
    });

    // ── Binary detection ──
    it("detects binary files (null bytes)", async () => {
      const filePath = path.join(tmpDir, "binary.bin");
      const buf = Buffer.alloc(100);
      buf[50] = 0; // null byte
      buf.write("hello", 0);
      await fs.writeFile(filePath, buf);

      const result = await fileExplorerService.readFileText({
        filePath,
        workspaceRoot: tmpDir,
      });
      expect(result.success).toBe(true);
      expect(result.data!.isBinary).toBe(true);
      expect(result.data!.encoding).toBe("binary");
    });

    // ── Non-regular file blocking ──
    it("blocks reading a directory as file", async () => {
      const dirPath = path.join(tmpDir, "subdir");
      await fs.mkdir(dirPath);

      const result = await fileExplorerService.readFileText({
        filePath: dirPath,
        workspaceRoot: tmpDir,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("directory");
    });

    // ── File not found ──
    it("returns error for non-existent file", async () => {
      const result = await fileExplorerService.readFileText({
        filePath: path.join(tmpDir, "nope.txt"),
        workspaceRoot: tmpDir,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("File does not exist");
    });

    // ── UTF-8 content ──
    it("reads UTF-8 files with special characters", async () => {
      const filePath = path.join(tmpDir, "unicode.txt");
      await fs.writeFile(filePath, "Héllo wörld 日本語 🎉");

      const result = await fileExplorerService.readFileText({
        filePath,
        workspaceRoot: tmpDir,
      });
      expect(result.success).toBe(true);
      expect(result.data!.content).toBe("Héllo wörld 日本語 🎉");
      expect(result.data!.isBinary).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // listDir
  // ─────────────────────────────────────────────────────────────
  describe("listDir", () => {
    it("lists directory contents", async () => {
      await fs.mkdir(path.join(tmpDir, "dir1"));
      await fs.writeFile(path.join(tmpDir, "file1.ts"), "code");

      const result = await fileExplorerService.listDir({ dirPath: tmpDir, excludePatterns: [] });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);

      // Directories first
      expect(result.data![0].type).toBe("directory");
      expect(result.data![0].name).toBe("dir1");
      expect(result.data![1].type).toBe("file");
      expect(result.data![1].name).toBe("file1.ts");
      expect(result.data![1].extension).toBe("ts");
    });

    it("reports hasChildren correctly", async () => {
      await fs.mkdir(path.join(tmpDir, "empty"));
      await fs.mkdir(path.join(tmpDir, "full"));
      await fs.writeFile(path.join(tmpDir, "full", "child.txt"), "c");

      const result = await fileExplorerService.listDir({
        dirPath: tmpDir,
        includeHidden: true,
        excludePatterns: [],
      });
      expect(result.success).toBe(true);

      const emptyDir = result.data!.find((e) => e.name === "empty");
      const fullDir = result.data!.find((e) => e.name === "full");
      expect(emptyDir!.hasChildren).toBe(false);
      expect(fullDir!.hasChildren).toBe(true);
    });

    it("excludes hidden files by default", async () => {
      await fs.writeFile(path.join(tmpDir, ".hidden"), "x");
      await fs.writeFile(path.join(tmpDir, "visible.txt"), "y");

      const result = await fileExplorerService.listDir({
        dirPath: tmpDir,
        excludePatterns: [],
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe("visible.txt");
    });

    it("returns error for non-existent directory", async () => {
      const result = await fileExplorerService.listDir({
        dirPath: path.join(tmpDir, "nope"),
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Directory does not exist");
    });

    it("returns error when path is a file", async () => {
      const filePath = path.join(tmpDir, "f.txt");
      await fs.writeFile(filePath, "x");

      const result = await fileExplorerService.listDir({ dirPath: filePath });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Path is not a directory");
    });

    it("files have size info", async () => {
      await fs.writeFile(path.join(tmpDir, "test.js"), "console.log('hi')");

      const result = await fileExplorerService.listDir({
        dirPath: tmpDir,
        excludePatterns: [],
      });
      const file = result.data!.find((e) => e.name === "test.js");
      expect(file!.size).toBeGreaterThan(0);
      expect(file!.hasChildren).toBe(false);
    });
  });
});
