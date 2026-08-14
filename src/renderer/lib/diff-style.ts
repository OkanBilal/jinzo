import type { CSSProperties } from "react";
import type { BaseCodeOptions, BaseDiffOptions } from "@pierre/diffs";

/**
 * Typography for every `@pierre/diffs` surface (`PatchDiff`, `File`).
 *
 * The library renders into a shadow root, so Tailwind's `text-*` utilities and
 * the `--text-*` scale in `index.css` never reach it — the size has to travel
 * in as the library's own `--diffs-font-size` custom property. `12px` mirrors
 * `text-xs`; keep the two in step if the scale moves.
 *
 * Spread onto the component's `style` prop so the diff viewer, code viewer, PR
 * diff, and the Edit/Write/ApplyPatch tool displays can't drift apart.
 */
export const DIFF_TYPOGRAPHY_STYLE = {
  "--diffs-font-size": "12px",
  "--diffs-font-family": "ui-monospace, monospace",
} as CSSProperties;

/**
 * Baseline `options` shared by every `@pierre/diffs` surface in the app, for
 * both `File` and `PatchDiff` (the fields live on `BaseCodeOptions`, which both
 * option types extend).
 *
 * The shadow root also blocks the app background, so `unsafeCSS` repaints the
 * library's own `--diffs-bg` from our `primary` scale — that selector list is
 * long and easy to mistype, which is the main reason this lives in one place.
 * `disableFileHeader` is part of the baseline because every surface renders its
 * own header chrome; a caller that wants the library's can override it.
 */
export function diffSurfaceOptions(isDarkMode: boolean): BaseCodeOptions {
  const bg = `var(--color-${isDarkMode ? "primary-950" : "primary"})`;
  return {
    theme: isDarkMode ? "pierre-dark" : "pierre-light",
    themeType: isDarkMode ? "dark" : "light",
    disableFileHeader: true,
    unsafeCSS: `:host, [data-diffs], [data-diffs-header], [data-error-wrapper], [data-line], [data-column-number], [data-code] { --diffs-bg: ${bg}; background-color: ${bg}; }`,
  };
}

/**
 * The baseline plus the layout every `PatchDiff` in the app uses: unified (never
 * split) columns that wrap rather than scroll, since diffs render inside narrow
 * panels and collapsible tool rows.
 *
 * `hunkSeparators` is omitted because `FileDiffOptions` narrows it, so the wider
 * `BaseDiffOptions` shape wouldn't be assignable to the `options` prop.
 */
export function patchDiffOptions(
  isDarkMode: boolean
): Omit<BaseDiffOptions, "hunkSeparators"> {
  return {
    ...diffSurfaceOptions(isDarkMode),
    diffStyle: "unified",
    overflow: "wrap",
  };
}
