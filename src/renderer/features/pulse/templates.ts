import type { ModeId } from "../../../shared/modes";

export type PulseTemplateCategory =
  | "status-reports"
  | "release-prep"
  | "incidents-triage"
  | "repo-hygiene"
  | "knowledge-work"
  | "briefings";

export interface PulseTemplate {
  id: string;
  category: PulseTemplateCategory;
  title: string;
  /** One-line hint on the template card (picker UI). */
  description: string;
  /** Full instruction passed to the agent as the run goal. */
  prompt: string;
  emoji: string;
  /** Which experience modes offer this template. Absent = every mode. */
  modes?: ModeId[];
  defaultFrequency: "hourly" | "daily" | "weekdays" | "weekly";
  defaultHour: number;
  defaultMinute: number;
  defaultDayOfWeek?: number; // 0=Sun..6=Sat
}

export const PULSE_CATEGORIES: { id: PulseTemplateCategory; label: string }[] = [
  { id: "status-reports", label: "Standups & summaries" },
  { id: "release-prep", label: "Shipping & releases" },
  { id: "incidents-triage", label: "Risk & stability" },
  { id: "repo-hygiene", label: "Repo hygiene" },
  { id: "knowledge-work", label: "Docs & digests" },
  { id: "briefings", label: "Briefings" },
];

// The original template corpus is git/repo-centric — developer-only. Work and
// chat sets below run workspace-less (optionally against a collection's
// sources), so their prompts never reference git.
const DEVELOPER: ModeId[] = ["developer"];
const WORK: ModeId[] = ["work"];
const CHAT: ModeId[] = ["chat"];

export const PULSE_TEMPLATES: PulseTemplate[] = [
  // ── Standups & summaries (git-centric — reliable in Pulse)
  {
    id: "standup-summary",
    category: "status-reports",
    title: "Daily standup digest",
    description:
      "Yesterday’s commits, authors, and themes from git — formatted for standup.",
    prompt:
      "Use git history for this workspace. Summarize work useful for a daily standup: commits since yesterday (subjects, authors, touched areas). Call out anything that looks risky (large diffs, migrations, lockfile-only changes). Keep bullets short; no speculation beyond what git shows.",
    modes: DEVELOPER,
    emoji: "📰",
    defaultFrequency: "weekdays",
    defaultHour: 9,
    defaultMinute: 0,
  },
  {
    id: "weekly-update",
    category: "status-reports",
    title: "Weekly engineering update",
    description:
      "Narrative of the week from merges, churn, and notable repo changes.",
    prompt:
      "From git logs and repo state (last ~7 days), draft a weekly engineering update: shipped themes, recurring actors or modules, infra/tooling changes, and open risks. If conventional commits exist, lean on them; otherwise infer themes from messages and paths. End with 3 bullet \"asks\" or follow-ups grounded in the repo.",
    modes: DEVELOPER,
    emoji: "📝",
    defaultFrequency: "weekly",
    defaultHour: 17,
    defaultMinute: 0,
    defaultDayOfWeek: 5,
  },
  {
    id: "weekly-pr-digest",
    category: "status-reports",
    title: "Merge & integration digest",
    description:
      "What landed recently — grouped by area — plus carry-over risks.",
    prompt:
      "Review recent integration activity via git (merge commits or main-line history over ~7 days). Group changes by subsystem or top-level folder. Highlight regressions-prone zones (auth, billing, migrations, CI configs). Mention dependency or lockfile churn explicitly. Stay factual to git; note when something needs human CI/issue tracker context.",
    modes: DEVELOPER,
    emoji: "📒",
    defaultFrequency: "weekly",
    defaultHour: 9,
    defaultMinute: 0,
    defaultDayOfWeek: 1,
  },
  {
    id: "branch-tracking-brief",
    category: "status-reports",
    title: "Branch vs default brief",
    description:
      "How this workspace compares to its default upstream branch.",
    prompt:
      "Inspect git remotes/branches for this workspace. Summarize how the current branch relates to the default branch (ahead/behind if determinable locally, notable divergence). List files or dirs with the most churn vs default branch using git diff stats if available. Suggest a minimal merge/rebase or QA focus — reporting only unless the user expects edits.",
    modes: DEVELOPER,
    emoji: "🔀",
    defaultFrequency: "weekdays",
    defaultHour: 8,
    defaultMinute: 30,
  },

  // ── Shipping & releases
  {
    id: "release-notes",
    category: "release-prep",
    title: "Release notes draft",
    description:
      "User-facing notes from recent merges — ready to paste into changelog or GitHub.",
    prompt:
      "Draft release notes from recent merged work in git (since last tag if tags exist, otherwise last ~2 weeks). Group into Features, Fixes, Breaking changes, Internal. Use PR/commit titles when present; avoid inventing ticket URLs. Call out DB migrations, env vars, or config changes explicitly.",
    modes: DEVELOPER,
    emoji: "📕",
    defaultFrequency: "weekly",
    defaultHour: 10,
    defaultMinute: 0,
    defaultDayOfWeek: 5,
  },
  {
    id: "release-checklist",
    category: "release-prep",
    title: "Pre-release checklist",
    description:
      "Repo-grounded gates: migrations, versioning, flags, and smoke paths.",
    prompt:
      "Build a pre-release checklist grounded in this repository: locate changelog/release docs, migration folders (e.g. Drizzle/prisma), feature-flag patterns, version files (package.json, Cargo.toml, etc.). Mark each item verify/not-applicable. Include suggested smoke tests inferred from README or scripts — no promises about external CI dashboards.",
    modes: DEVELOPER,
    emoji: "✅",
    defaultFrequency: "weekly",
    defaultHour: 14,
    defaultMinute: 0,
    defaultDayOfWeek: 4,
  },
  {
    id: "changelog-update",
    category: "release-prep",
    title: "Changelog unreleased section",
    description:
      "Proposed CHANGELOG bullets aligned with conventional commits.",
    prompt:
      "Find CHANGELOG.md or similar. Propose new bullets for an [Unreleased] section based on git history since the last changelog header or tag. Follow the file’s existing style. Separate noteworthy vs internal-only lines; flag anything uncertain.",
    modes: DEVELOPER,
    emoji: "🟡",
    defaultFrequency: "weekly",
    defaultHour: 16,
    defaultMinute: 0,
    defaultDayOfWeek: 5,
  },
  {
    id: "migration-release-sync",
    category: "release-prep",
    title: "DB migrations vs schema sanity",
    description:
      "Cross-check migration files and schema hints before you ship.",
    prompt:
      "Scan for database migration folders and schema definitions (ORM configs, SQL migrations). Summarize pending migrations vs main branch if comparable. Flag risky patterns (data backfills, destructive drops, missing rollbacks). Do not apply migrations — analysis and checklist only.",
    modes: DEVELOPER,
    emoji: "🗄️",
    defaultFrequency: "weekly",
    defaultHour: 11,
    defaultMinute: 0,
    defaultDayOfWeek: 4,
  },

  // ── Risk & stability (repo files + git — no CI API)
  {
    id: "ci-config-review",
    category: "incidents-triage",
    title: "CI workflow review",
    description:
      "Static pass on workflow YAML — flaky patterns and sharp edges.",
    prompt:
      "Locate CI configs (.github/workflows, .gitlab-ci.yml, Azure/build YAML, etc.). Summarize workflows touching tests/build/deploy; flag brittle patterns (unpinned actions, missing caches, reliance on secrets without fallbacks, heavy integration suites on every push). Propose incremental hardening — you cannot query live CI status unless CLI/network is available.",
    modes: DEVELOPER,
    emoji: "🛠️",
    defaultFrequency: "weekly",
    defaultHour: 8,
    defaultMinute: 0,
    defaultDayOfWeek: 2,
  },
  {
    id: "merge-risk-qa-brief",
    category: "incidents-triage",
    title: "Merge-risk QA brief",
    description:
      "What changed vs default branch — focused manual QA angles.",
    prompt:
      "Using git diff vs the repo’s default integration branch when available (--stat and high-level paths), propose a concise QA brief: surfaces to exercise, edge cases suggested by changed files, and regression hotspots. If diff scope is huge, prioritize top directories and public APIs. Note limitations if branches aren’t fetched.",
    modes: DEVELOPER,
    emoji: "📋",
    defaultFrequency: "daily",
    defaultHour: 9,
    defaultMinute: 30,
  },
  {
    id: "issue-triage",
    category: "incidents-triage",
    title: "Bug triage worksheet",
    description:
      "Severity rubric + repro checklist tailored to repo conventions.",
    prompt:
      "Read CONTRIBUTING.md, issue templates (.github/ISSUE_TEMPLATE), SECURITY.md if present. Produce a reusable bug triage worksheet: severity definitions aligned with this project, repro steps checklist, info to request from reporters, and suggested labels/categories inferred from docs — not from external trackers Pulse cannot see.",
    modes: DEVELOPER,
    emoji: "💬",
    defaultFrequency: "weekdays",
    defaultHour: 10,
    defaultMinute: 0,
  },

  // ── Repo hygiene (filesystem + git — safe, read-first)
  {
    id: "dependency-manifest-review",
    category: "repo-hygiene",
    title: "Dependency manifest review",
    description:
      "package.json / lockfile sanity — duplicates, engines, obvious smells.",
    prompt:
      "Inspect package manifests and lockfiles present (npm/yarn/pnpm, Cargo, go.mod, etc.). Report duplicate/conflicting dependency declarations, engines/node constraints, workspace boundaries if monorepo, and scripts that look outdated vs README. Avoid requiring network installs — flag places where maintainers should run `outdated` or audits manually.",
    modes: DEVELOPER,
    emoji: "📦",
    defaultFrequency: "weekly",
    defaultHour: 10,
    defaultMinute: 0,
    defaultDayOfWeek: 3,
  },
  {
    id: "readme-scripts-audit",
    category: "repo-hygiene",
    title: "README ↔ scripts audit",
    description:
      "Docs vs actual npm/Makefile scripts — drift that trips newcomers.",
    prompt:
      "Compare README (and docs/getting-started) with declared scripts and tooling configs (package.json scripts, Makefile, task runners). List mismatches: documented commands that don’t exist, missing prerequisites (Node version, DB), stale paths. Suggest minimal doc patches as bullet points.",
    modes: DEVELOPER,
    emoji: "📖",
    defaultFrequency: "weekly",
    defaultHour: 15,
    defaultMinute: 0,
    defaultDayOfWeek: 3,
  },
  {
    id: "stale-branch-report",
    category: "repo-hygiene",
    title: "Stale branches inventory",
    description:
      "Which remote branches look merged or abandoned — report only.",
    prompt:
      "Using git branch listings (prefer read-only inspection), identify remote branches likely merged into the default branch or stale with no recent commits. Produce a table: branch name, last activity hint if visible, recommendation (candidate for deletion vs investigate). Explicitly do not delete branches — reporting only.",
    modes: DEVELOPER,
    emoji: "🌿",
    defaultFrequency: "weekly",
    defaultHour: 16,
    defaultMinute: 0,
    defaultDayOfWeek: 5,
  },
  {
    id: "todo-hotspot-scan",
    category: "repo-hygiene",
    title: "TODO / FIXME radar",
    description:
      "Recent hotspots via markers — tech debt visibility.",
    prompt:
      "Search the codebase for TODO, FIXME, HACK, XXX markers (respect .gitignore). Group by directory or package; estimate urgency from surrounding code comments only. Exclude vendor/build dirs if obvious. Summarize top 10 hotspots maintainers should schedule — no automatic edits.",
    modes: DEVELOPER,
    emoji: "🎯",
    defaultFrequency: "weekdays",
    defaultHour: 16,
    defaultMinute: 30,
  },
  // ── Docs & digests (work — collection sources / managed files, never git)
  {
    id: "daily-doc-digest",
    category: "knowledge-work",
    title: "Daily document digest",
    description:
      "Morning summary of your project sources — what each covers, what changed, what needs attention.",
    prompt:
      "Review the project source documents available to you. Produce a short morning digest: what each document covers, anything that looks new or changed, and up to three items that deserve attention today. Write it as a polished summary document the user can skim in one minute.",
    modes: WORK,
    emoji: "🗞️",
    defaultFrequency: "weekdays",
    defaultHour: 8,
    defaultMinute: 30,
  },
  {
    id: "weekly-report-draft",
    category: "knowledge-work",
    title: "Weekly report draft",
    description:
      "Drafts the weekly status report from your project sources and recent work.",
    prompt:
      "Draft a weekly status report from the project source documents available to you. Structure it as: accomplishments, in-progress items, blockers, and next week's focus. Where the sources are thin, mark the section as needing the user's input rather than inventing content. Save the draft as a document the user can edit and share.",
    modes: WORK,
    emoji: "📝",
    defaultFrequency: "weekly",
    defaultHour: 16,
    defaultMinute: 0,
    defaultDayOfWeek: 5,
  },
  {
    id: "meeting-notes-cleanup",
    category: "knowledge-work",
    title: "Meeting notes cleanup",
    description:
      "Turns rough meeting notes in your sources into structured minutes with action items.",
    prompt:
      "Find meeting notes among the project source documents. Rewrite each set as structured minutes: attendees (if stated), decisions, action items with owners, and open questions. Keep the original files untouched; produce cleaned versions as new documents and list what you produced.",
    modes: WORK,
    emoji: "🧹",
    defaultFrequency: "weekly",
    defaultHour: 17,
    defaultMinute: 0,
    defaultDayOfWeek: 5,
  },
  {
    id: "deliverable-status",
    category: "knowledge-work",
    title: "Deliverable status check",
    description:
      "Reviews in-progress documents and reports what is finished, stale, or blocked.",
    prompt:
      "Review the documents you have produced in this project so far, together with the project sources. Report per deliverable: finished, in progress, or stale (untouched lately), and whether anything blocks completion. End with a short prioritized list of what to finish next.",
    modes: WORK,
    emoji: "📊",
    defaultFrequency: "weekly",
    defaultHour: 9,
    defaultMinute: 30,
    defaultDayOfWeek: 1,
  },
  // ── Briefings (chat — read-only; the reply IS the deliverable)
  {
    id: "daily-briefing",
    category: "briefings",
    title: "Daily briefing",
    description:
      "A read-only morning briefing from your project sources — answers in chat, changes nothing.",
    prompt:
      "Give a concise morning briefing based on the project source documents available to you: the key themes, anything time-sensitive, and up to three suggested focus points for today. Answer entirely in chat — do not create or modify any files.",
    modes: CHAT,
    emoji: "☀️",
    defaultFrequency: "weekdays",
    defaultHour: 8,
    defaultMinute: 0,
  },
  {
    id: "weekly-recap",
    category: "briefings",
    title: "Weekly recap",
    description:
      "A read-only end-of-week recap of your project's sources and conversations.",
    prompt:
      "Give an end-of-week recap based on the project source documents available to you: what the week's material covered, patterns worth noticing, and open questions going into next week. Answer entirely in chat — do not create or modify any files.",
    modes: CHAT,
    emoji: "🌇",
    defaultFrequency: "weekly",
    defaultHour: 17,
    defaultMinute: 30,
    defaultDayOfWeek: 5,
  },
];
