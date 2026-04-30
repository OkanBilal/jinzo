/**
 * Remote http(s) image URLs cannot load directly under the renderer CSP (`img-src` disallows arbitrary https).
 * Route them through mains-img — see `registerImageProxyHandler` (main).
 */
export function proxiedImageSrc(src: string | undefined | null): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("https://") || src.startsWith("http://")) {
    return `mains-img://proxy?url=${encodeURIComponent(src)}`;
  }
  return src;
}
