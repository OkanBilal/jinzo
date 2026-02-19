import { getConnectionWithTokens } from "../sync/sync.connection-utils";

// ─────────────────────────────────────────────────────────────
// Domain Map
// ─────────────────────────────────────────────────────────────
const GITHUB_DOMAINS = ["githubusercontent.com", "github.com"];

// ─────────────────────────────────────────────────────────────
// Image Proxy Service
// ─────────────────────────────────────────────────────────────
export const imageProxyService = {
  matchUrlToGithub(url: string): boolean {
    try {
      const hostname = new URL(url).hostname;
      return GITHUB_DOMAINS.some((d) => hostname.endsWith(d));
    } catch {
      return false;
    }
  },

  async buildGithubAuthHeaders(): Promise<Record<string, string> | null> {
    const conn = await getConnectionWithTokens("github");
    if (!conn?.accessToken) return null;
    return { Authorization: `token ${conn.accessToken}` };
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
