import { app, protocol, net } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { imageProxyService } from "./imageProxy.service";
import { workspacesRepo } from "../workspaces/workspaces.repo";

//TODO: imageproxy service limitations check

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

function checkContentLength(response: Response): Response | null {
  const length = response.headers.get("content-length");
  if (length && parseInt(length, 10) > MAX_IMAGE_SIZE) {
    return new Response("Image too large", { status: 413 });
  }
  return null;
}

/**
 * Wrap `body` in a pass-through stream that aborts once cumulative bytes
 * exceed `maxBytes`. `Content-Length` alone is insufficient — servers can omit
 * it (chunked transfer) and a hostile/misconfigured host could feed us an
 * arbitrarily large payload that gets buffered into renderer memory.
 */
function enforceMaxBytes(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): ReadableStream<Uint8Array> | null {
  if (!body) return body;

  let total = 0;
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        total += value.byteLength;
        if (total > maxBytes) {
          // Cancel upstream and surface a stream error so the fetch caller
          // (and the renderer `<img>` tag) fails fast without buffering more.
          try {
            await reader.cancel("image too large");
          } catch {
            /* ignore */
          }
          controller.error(
            new Error(`image exceeds ${maxBytes} bytes (aborted at ${total})`),
          );
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {
        /* ignore */
      });
    },
  });
}

/**
 * Register the mains-img scheme as privileged.
 * MUST be called BEFORE app.ready.
 */
export function registerImageProxyScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "mains-img",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
    {
      scheme: "mains-capture",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
    {
      scheme: "mains-appicon",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
    {
      scheme: "mains-localimg",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

const LOCALIMG_EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

let cachedWorkspaceRoots: string[] = [];
let workspaceRootsExpiresAt = 0;
const WORKSPACE_ROOTS_TTL_MS = 60_000;

async function getWorkspaceRoots(): Promise<string[]> {
  const now = Date.now();
  if (now < workspaceRootsExpiresAt) return cachedWorkspaceRoots;
  try {
    const ws = await workspacesRepo.findAll(true);
    cachedWorkspaceRoots = ws
      .map((w) => w.rootPath)
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .map((p) => path.resolve(p));
  } catch {
    cachedWorkspaceRoots = [];
  }
  workspaceRootsExpiresAt = now + WORKSPACE_ROOTS_TTL_MS;
  return cachedWorkspaceRoots;
}

function expandTilde(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

async function isPathInAllowedRoot(absPath: string): Promise<boolean> {
  const roots = [
    path.resolve(path.join(os.homedir(), ".codex", "generated_images")),
    path.resolve(path.join(os.homedir(), ".codex", "sessions")),
    path.resolve(path.join(os.homedir(), ".codex", "skills")),
    path.resolve(path.join(os.homedir(), ".codex", "plugins")),
    path.resolve(path.join(os.homedir(), ".agents", "skills")),
    path.resolve(path.join(os.homedir(), "Desktop")),
    path.resolve(path.join(os.homedir(), "Documents")),
    path.resolve(path.join(os.homedir(), "Downloads")),
    path.resolve(path.join(os.homedir(), "Pictures")),
    path.resolve(app.getPath("userData")),
    ...(await getWorkspaceRoots()),
  ];
  for (const root of roots) {
    if (absPath === root || absPath.startsWith(root + path.sep)) {
      return true;
    }
  }
  return false;
}

async function serveLocalImage(rawPath: string): Promise<Response> {
  if (!rawPath) return new Response("Missing path", { status: 400 });
  const expanded = expandTilde(rawPath);
  if (!path.isAbsolute(expanded)) {
    return new Response("Path must be absolute", { status: 400 });
  }
  const resolved = path.resolve(expanded);
  if (resolved.includes("\0")) return new Response("Invalid path", { status: 400 });

  const ext = path.extname(resolved).toLowerCase();
  const mime = LOCALIMG_EXT_MIME[ext];
  if (!mime) return new Response("Unsupported file type", { status: 400 });

  if (!(await isPathInAllowedRoot(resolved))) {
    console.warn("[mains-localimg] denied (not in allowed roots):", resolved);
    return new Response("Path not in allowed roots", { status: 403 });
  }

  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(resolved);
  } catch (err) {
    console.warn("[mains-localimg] stat failed:", resolved, err);
    return new Response("Not found", { status: 404 });
  }
  if (stat.isSymbolicLink()) {
    console.warn("[mains-localimg] denied symlink:", resolved);
    return new Response("Symlinks not allowed", { status: 403 });
  }
  if (!stat.isFile()) {
    console.warn("[mains-localimg] not a file:", resolved);
    return new Response("Not a file", { status: 404 });
  }
  if (stat.size > MAX_IMAGE_SIZE) {
    console.warn("[mains-localimg] too large:", resolved, stat.size);
    return new Response("Image too large", { status: 413 });
  }

  const data = fs.readFileSync(resolved);
  console.log("[mains-localimg] served:", resolved, stat.size, "bytes");
  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=60",
    },
  });
}

/** Shared helper to read a single PNG from a sandboxed directory. Prevents
 * path traversal by rejecting any name containing slashes or `..`. */
function serveLocalPng(baseDir: string, rawName: string): Response {
  if (!rawName || rawName.includes("..") || rawName.includes("/") || rawName.includes("\\")) {
    return new Response("Invalid filename", { status: 400 });
  }
  const filePath = path.join(baseDir, rawName);
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  if (!resolved.startsWith(resolvedBase + path.sep)) {
    return new Response("Path escape denied", { status: 400 });
  }
  if (!fs.existsSync(resolved)) {
    return new Response("Not found", { status: 404 });
  }
  const data = fs.readFileSync(resolved);
  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/**
 * Register the protocol handler for mains-img:// URLs.
 * Must be called AFTER app.ready (inside initializeApp).
 */
export function registerImageProxyHandler() {
  // Serve browser capture PNGs from userData/browser-captures with path safety.
  protocol.handle("mains-capture", async (request) => {
    try {
      const requestUrl = new URL(request.url);
      // mains-capture://<host-ignored>/<filename>
      const raw = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, ""));
      const baseDir = path.join(app.getPath("userData"), "browser-captures");
      return serveLocalPng(baseDir, raw);
    } catch (error) {
      console.error("[mains-capture] handler error:", error);
      return new Response("Capture proxy error", { status: 500 });
    }
  });

  // Serve cached application icons from userData/app-icons. The main process
  // writes `${id}.png` for each detected installed app during
  // `detectInstalledApps()` and the renderer references them via
  // `mains-appicon://icon/<id>.png` — no base64 blobs in memory.
  protocol.handle("mains-appicon", async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const raw = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, ""));
      const baseDir = path.join(app.getPath("userData"), "app-icons");
      return serveLocalPng(baseDir, raw);
    } catch (error) {
      console.error("[mains-appicon] handler error:", error);
      return new Response("App icon error", { status: 500 });
    }
  });

  protocol.handle("mains-localimg", async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const rawPath = requestUrl.searchParams.get("path") ?? "";
      return await serveLocalImage(decodeURIComponent(rawPath));
    } catch (error) {
      console.error("[mains-localimg] handler error:", error);
      return new Response("Local image proxy error", { status: 500 });
    }
  });

    protocol.handle("mains-img", async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const originalUrl = requestUrl.searchParams.get("url");

      if (!originalUrl) {
        return new Response("Missing url parameter", { status: 400 });
      }

      // Validate it's a real URL
      let parsed: URL;
      try {
        parsed = new URL(originalUrl);
      } catch {
        return new Response("Invalid url parameter", { status: 400 });
      }

      // Only proxy http(s) URLs
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return new Response("Only HTTP(S) URLs are supported", { status: 400 });
      }

      // GitHub: authenticated fetch
      if (imageProxyService.matchUrlToGithub(originalUrl)) {
        const headers = await imageProxyService.buildGithubAuthHeaders();
        if (headers) {
          const response = await imageProxyService.fetchWithAuth(
            originalUrl,
            headers
          );

          const tooLarge = checkContentLength(response);
          if (tooLarge) return tooLarge;

          return new Response(
            enforceMaxBytes(response.body, MAX_IMAGE_SIZE),
            {
              status: response.status,
              headers: {
                "Content-Type":
                  response.headers.get("content-type") ||
                  "application/octet-stream",
                "Cache-Control": "private, max-age=3600",
              },
            },
          );
        }
      }

      // Everything else — passthrough with net.fetch
      const response = await net.fetch(originalUrl);
      const tooLarge = checkContentLength(response);
      if (tooLarge) return tooLarge;

      return new Response(enforceMaxBytes(response.body, MAX_IMAGE_SIZE), {
        status: response.status,
        headers: {
          "Content-Type":
            response.headers.get("content-type") || "application/octet-stream",
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch (error) {
      console.error("[imageProxy] Protocol handler error:", error);
      return new Response("Image proxy error", { status: 500 });
    }
  });
}
