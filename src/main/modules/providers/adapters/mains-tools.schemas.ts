// ─────────────────────────────────────────────────────────────
// Mains tool schemas — the single source of truth
//
// One Zod schema per mains tool. `z.infer`/`z.input` types the handler
// args (mains-tools.core.ts); `z.toJSONSchema` renders the JSON Schema
// that the Copilot / Codex / Cursor adapters need (mains-tools.registry.ts).
//
// This module is a leaf: it depends on nothing in the subsystem, so the
// dependency flow `schemas ← core ← registry ← drivers` stays acyclic.
// ─────────────────────────────────────────────────────────────

import { z } from "zod";

// The finding fields are shared between SaveFinding (one finding) and
// SaveFindings (an array of findings), so they're declared once.
const findingFields = {
  severity: z
    .enum(["critical", "warning", "info"])
    .describe("Finding severity level"),
  file: z.string().describe("File path where the finding was detected"),
  lineStart: z.number().optional().describe("Start line number"),
  lineEnd: z.number().optional().describe("End line number"),
  message: z.string().describe("Description of the finding"),
  reason: z.string().describe("Why this was flagged"),
  suggestion: z.string().optional().describe("Suggested fix"),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional metadata as JSON"),
};

export const GetWorkspaceDiffSchema = z.object({
  runId: z
    .string()
    .optional()
    .describe("Run ID to get diff for a specific run"),
});

export const SaveReviewSchema = z.object({
  title: z.string().describe("Review title"),
  summary: z.string().optional().describe("Review summary"),
  // No `.default("open")`: a default would force `status` into JSON Schema's
  // `required` list, changing the agent-facing contract. The handler applies
  // the "open" default at runtime instead.
  status: z
    .enum(["open", "in_review", "approved", "rejected"])
    .optional()
    .describe("Review status"),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional metadata as JSON"),
});

export const SaveFindingSchema = z.object({
  reviewId: z.string().describe("ID of the parent review"),
  ...findingFields,
});

export const SaveFindingsSchema = z.object({
  reviewId: z.string().describe("ID of the parent review"),
  findings: z
    .array(z.object(findingFields))
    .describe("Array of findings to save"),
});

export const CommitChangesSchema = z.object({
  // Optional: the handler's instructions-first handshake hands back commit
  // instructions on the first call when `message` is omitted.
  message: z
    .string()
    .optional()
    .describe(
      "The commit message. Omit on first call to retrieve commitInstructions if configured.",
    ),
  files: z
    .array(z.string())
    .optional()
    .describe(
      "Specific files to stage. If omitted, stages all changes (git add -A)",
    ),
});

export const CreatePRSchema = z.object({
  title: z.string().describe("The pull request title"),
  body: z.string().optional().describe("The pull request body/description"),
  base: z
    .string()
    .optional()
    .describe("The base branch to merge into (defaults to the repo default branch)"),
  draft: z.boolean().optional().describe("Create as a draft pull request"),
  labels: z
    .array(z.string())
    .optional()
    .describe("Labels to add to the pull request"),
});

export const CheckPackageSchema = z.object({
  packages: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Package name (e.g. 'axios', '@types/node')"),
        version: z.string().optional().describe("Optional version"),
        ecosystem: z
          .enum(["npm", "pypi", "cargo", "go", "maven", "rubygems"])
          .optional()
          .describe("Package ecosystem (defaults to npm)"),
      }),
    )
    .describe("Packages to check"),
});

// Handler arg types are the *input* types (pre-parse): the non-Claude drivers
// pass raw args straight through without Zod parsing, so optional fields with
// defaults can legitimately arrive undefined.
export type GetWorkspaceDiffArgs = z.input<typeof GetWorkspaceDiffSchema>;
export type SaveReviewArgs = z.input<typeof SaveReviewSchema>;
export type SaveFindingArgs = z.input<typeof SaveFindingSchema>;
export type SaveFindingsArgs = z.input<typeof SaveFindingsSchema>;
export type CommitChangesArgs = z.input<typeof CommitChangesSchema>;
export type CreatePRArgs = z.input<typeof CreatePRSchema>;
export type CheckPackageArgs = z.input<typeof CheckPackageSchema>;
