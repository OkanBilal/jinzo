import { protocol, net } from "electron";
import { imageProxyService } from "./imageProxy.service";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

function checkContentLength(response: Response): Response | null {
  const length = response.headers.get("content-length");
  if (length && parseInt(length, 10) > MAX_IMAGE_SIZE) {
    return new Response("Image too large", { status: 413 });
  }
  return null;
}

/**
 * Register the jinzo-img scheme as privileged.
 * MUST be called BEFORE app.ready.
 */
export function registerImageProxyScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "jinzo-img",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

/**
 * Register the protocol handler for jinzo-img:// URLs.
 * Must be called AFTER app.ready (inside initializeApp).
 */
export function registerImageProxyHandler() {
  protocol.handle("jinzo-img", async (request) => {
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

          return new Response(response.body, {
            status: response.status,
            headers: {
              "Content-Type":
                response.headers.get("content-type") ||
                "application/octet-stream",
              "Cache-Control": "private, max-age=3600",
            },
          });
        }
      }

      // Everything else — passthrough with net.fetch
      const response = await net.fetch(originalUrl);
      const tooLarge = checkContentLength(response);
      if (tooLarge) return tooLarge;

      return new Response(response.body, {
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
