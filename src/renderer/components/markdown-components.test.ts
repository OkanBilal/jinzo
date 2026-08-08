import { describe, it, expect } from "vitest";
import { isRemoteImageSrc } from "./markdown-components";

// Only network URLs can act as exfiltration beacons — everything else
// (app schemes, data URIs, workspace paths) must keep loading directly.
describe("isRemoteImageSrc", () => {
  it.each([
    ["https://evil.example/x.png?d=secret", true],
    ["http://evil.example/x.png", true],
    ["mains-capture://shot-1.png", false],
    ["mains-img://proxy?url=…", false],
    ["data:image/png;base64,AAAA", false],
    ["/Users/me/project/diagram.png", false],
    ["./relative.png", false],
    ["", false],
    [undefined, false],
  ] as const)("%s → %s", (src, expected) => {
    expect(isRemoteImageSrc(src)).toBe(expected);
  });
});
