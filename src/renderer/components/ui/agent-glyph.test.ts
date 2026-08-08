import { describe, it, expect } from "vitest";
import { glyphCells } from "./agent-glyph";

describe("glyphCells", () => {
  it("is deterministic for the same seed", () => {
    expect(glyphCells("Security review")).toEqual(glyphCells("Security review"));
  });

  it("differs between typical sibling agents", () => {
    expect(glyphCells("Security review")).not.toEqual(glyphCells("Test gaps review"));
    expect(glyphCells("Security review")).not.toEqual(glyphCells("Maintainability review"));
  });

  it("mirrors vertically so the mark reads as deliberate", () => {
    const cells = glyphCells("Security review");
    // Derive the side from the pattern itself so grid-size tweaks don't
    // silently turn this into an out-of-bounds no-op.
    const grid = Math.sqrt(cells.length);
    expect(Number.isInteger(grid)).toBe(true);
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        expect(cells[row * grid + col]).toBe(cells[row * grid + (grid - 1 - col)]);
      }
    }
  });

  it("is never empty, even for degenerate seeds", () => {
    for (const seed of ["", "a", "  "]) {
      expect(glyphCells(seed).some(Boolean)).toBe(true);
    }
  });
});
