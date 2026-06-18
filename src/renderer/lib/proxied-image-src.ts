/**
 * Remote http(s) image URLs cannot load directly under the renderer CSP (`img-src` disallows arbitrary https).
 * Route them through mains-img — see `registerImageProxyHandler` (main).
 */
export function proxiedImageSrc(src: string | undefined | null): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("https://") || src.startsWith("http://")) {
    // Web mode (no Electron preload): route through the backend's same-origin
    // HTTP image proxy instead of the Electron `mains-img://` custom protocol.
    if (
      typeof window !== "undefined" &&
      !(window as { mainTransport?: unknown }).mainTransport
    ) {
      return `/__img?url=${encodeURIComponent(src)}`;
    }
    return `mains-img://proxy?url=${encodeURIComponent(src)}`;
  }
  return src;
}
