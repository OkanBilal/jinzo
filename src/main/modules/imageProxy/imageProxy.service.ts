import * as os from "os";
import * as path from "path";
import { getConnectionWithSecrets } from "../connections";
import { signLocalImagePath } from "./imageProxy.signing";

// ─────────────────────────────────────────────────────────────
// Domain Map
// ─────────────────────────────────────────────────────────────
const GITHUB_DOMAINS = ["githubusercontent.com", "github.com"];

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

function expandTilde(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

// ─────────────────────────────────────────────────────────────
// Image Proxy Service
// ─────────────────────────────────────────────────────────────
export const imageProxyService = {
  /**
   * Returns a signed `mains-localimg://` URL the renderer can drop straight
   * into an `<img>` tag. Validates extension cheaply — does not stat the file,
   * since the protocol handler will do that and return 404 if it's missing.
   * The HMAC signature is what authorizes the path, so the policy applied
   * here is the *only* policy enforced at request time.
   */
  signLocalImageUrl(rawPath: string, ttlMs?: number): string | null {
    if (typeof rawPath !== "string" || rawPath.length === 0) return null;
    const expanded = expandTilde(rawPath);
    if (!path.isAbsolute(expanded)) return null;
    const resolved = path.resolve(expanded);
    if (resolved.includes("\0")) return null;
    const ext = path.extname(resolved).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) return null;
    return signLocalImagePath(resolved, ttlMs);
  },

  matchUrlToGithub(url: string): boolean {
    try {
      const hostname = new URL(url).hostname;
      return GITHUB_DOMAINS.some((d) => hostname.endsWith(d));
    } catch {
      return false;
    }
  },

  async buildGithubAuthHeaders(): Promise<Record<string, string> | null> {
    const conn = await getConnectionWithSecrets("github");
    if (!conn?.secrets.token) return null;
    return { Authorization: `token ${conn.secrets.token}` };
  },

  async fetchWithAuth(
    url: string,
    headers: Record<string, string>
  ): Promise<Response> {
    // First request with auth, manual redirect to prevent header leakage
    let response = await fetch(url, {
      headers,
      redirect: "manual",
    });

    // Follow redirects without auth headers (prevent token leakage to CDNs)
    let redirectCount = 0;
    const MAX_REDIRECTS = 5;
    while (
      redirectCount < MAX_REDIRECTS &&
      response.status >= 300 &&
      response.status < 400
    ) {
      const location = response.headers.get("location");
      if (!location) break;

      const redirectUrl = new URL(location, url).toString();
      response = await fetch(redirectUrl, { redirect: "manual" });
      redirectCount++;
    }

    return response;
  },
};
