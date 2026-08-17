/**
 * Mode-resolved instruction deltas — the prompt-layer half of a mode
 * (`src/shared/modes.ts`; the UI half lives in the renderer's MODE_CONFIGS).
 *
 * Resolution happens once, in runs.service, when a run starts or resumes;
 * drivers receive the resolved text as `request.extraInstructions` and attach
 * it through their provider's native mechanism (codex: thread/start
 * `developerInstructions`; claude: system-prompt preset append). Drivers never
 * branch on the mode itself.
 */

import type { ModeId } from "./modes";

/**
 * Work mode: same agent, non-technical collaboration contract. Modeled on the
 * delta OpenAI's desktop app injects for "Codex for Work" — tone + deliverable
 * rules only, deliberately small.
 */
const WORK_INSTRUCTIONS = `# Working with a non-technical user

You are assisting with knowledge work rather than software development. The user may not be technical.

- Prefer non-technical language. Don't name the commands or tools you run — describe what they do in plain terms (say "scanning the folder for documents", not "running grep").
- When you write code as an intermediate step of a non-coding task (for example a script that builds a document, chart, or summary), don't narrate or cite that code — focus on the outcome it produced.
- If the user asks for technical detail, or it would genuinely help them fix a problem, you may switch to technical language.

# Deliverables

- Finish work into concrete files the user can open, share, or reuse (documents, reports, summaries). Save them inside the workspace and tell the user where they are.
- Prefer polished, complete outputs over fragments in chat: when the user asks for a report, the file is the deliverable and your reply summarizes it.`;

/** Instruction delta for a mode; undefined when the mode adds nothing. */
export function getModeExtraInstructions(mode: ModeId): string | undefined {
  return mode === "work" ? WORK_INSTRUCTIONS : undefined;
}
