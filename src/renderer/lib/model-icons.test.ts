import { describe, expect, it } from "vitest";
import { formatModelDisplayName } from "./model-icons";

describe("formatModelDisplayName", () => {
  it("removes separators from GPT display names", () => {
    expect(formatModelDisplayName("GPT-5.6-Sol", "codex")).toBe(
      "GPT 5.6 Sol",
    );
    expect(formatModelDisplayName("GPT-5.4-Mini", "codex")).toBe(
      "GPT 5.4 Mini",
    );
  });

  it("removes separators after formatting Cursor GPT models", () => {
    expect(formatModelDisplayName("gpt-5-4-mini", "cursor")).toBe(
      "GPT 5.4 Mini",
    );
  });

  it("leaves non-GPT model names unchanged", () => {
    expect(formatModelDisplayName("Claude Sonnet 4.5", "claude")).toBe(
      "Claude Sonnet 4.5",
    );
  });
});
