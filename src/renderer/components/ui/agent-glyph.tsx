import { useMemo, type CSSProperties } from "react";

/** Side of the glyph grid — one step finer than the 3×3 spinners, so
 *  patterns are distinct at a glance but cells stay chunky at size-4. */
const GRID = 4;
/** Columns actually decided by the hash; the rest mirror. */
const HALF = Math.ceil(GRID / 2);

const TEMPLATE = `repeat(${GRID}, minmax(0, 1fr))`;

/**
 * Deterministic cell pattern for a seed string. Exported for tests.
 *
 * FNV-1a seeds an LCG that decides the left half of each row; the right half
 * mirrors it (the identicon trick — symmetry is what makes a random scatter
 * read as a deliberate mark). Guaranteed non-empty.
 */
export function glyphCells(seed: string): boolean[] {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const bits: boolean[] = [];
  let state = h || 1;
  for (let i = 0; i < GRID * HALF; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    bits.push(((state >>> 16) & 1) === 1);
  }
  const cells: boolean[] = new Array(GRID * GRID).fill(false);
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < HALF; col++) {
      const on = bits[row * HALF + col];
      cells[row * GRID + col] = on;
      cells[row * GRID + (GRID - 1 - col)] = on;
    }
  }
  if (!cells.some(Boolean)) cells[Math.floor((GRID * GRID) / 2)] = true;
  return cells;
}

/**
 * Deterministic twinkle timing for one lit cell. GenerateSpinner rolls random
 * phases per mount; here they hash from (seed, cell) instead, so the same
 * agent breathes the same way on every surface and re-renders never re-roll.
 */
function cellTiming(seed: string, index: number): { dur: number; delay: number } {
  let h = 0x811c9dc5;
  const key = `${seed}#${index}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return {
    dur: 900 + (Math.abs(h) % 1100),
    delay: -(Math.abs(Math.imul(h, 2654435761)) % 2000),
  };
}

/**
 * Identity mark in the ascii-spinner family: the same tiny square-grid
 * language as SquareSpinner/GenerateSpinner, with the pattern hashed from
 * `seed` so one agent renders the same mark everywhere, forever.
 *
 * While `active`, the pattern's lit cells twinkle (GenerateSpinner's
 * keyframes) — the mark stays readable because the unlit ghost cells hold
 * still and the lit cells stagger. When work ends the animation drops and the
 * mark freezes. Color inherits from the surrounding text via `currentColor`
 * (pair with `subagentColorClass`); size comes from `className`.
 */
export function AgentGlyph({
  seed,
  active = false,
  className = "size-4",
}: {
  seed: string;
  active?: boolean;
  className?: string;
}) {
  const cells = useMemo(() => glyphCells(seed), [seed]);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 gap-px ${className}`}
      style={{ gridTemplateColumns: TEMPLATE, gridTemplateRows: TEMPLATE }}
    >
      {cells.map((on, i) => {
        if (on && active) {
          const { dur, delay } = cellTiming(seed, i);
          return (
            <span
              key={i}
              className="generate-square"
              style={
                {
                  "--gsq-dur": `${dur}ms`,
                  "--gsq-delay": `${delay}ms`,
                } as CSSProperties
              }
            />
          );
        }
        return (
          <span
            key={i}
            className="rounded-[1px] bg-current"
            style={{ opacity: on ? 1 : 0.15 }}
          />
        );
      })}
    </span>
  );
}
