import { asc, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../../db/client";
import { cues } from "../../db/schema";
import type { CreateCueInput, Cue, UpdateCueInput } from "./cues.dto";

export const cuesRepo = {
  findByProject(projectId: string): Cue[] {
    const db = getDb();
    return db
      .select()
      .from(cues)
      .where(eq(cues.projectId, projectId))
      .orderBy(desc(cues.isPinned), asc(cues.sortOrder), desc(cues.updatedAt))
      .all();
  },

  findById(id: string): Cue | undefined {
    const db = getDb();
    return db.select().from(cues).where(eq(cues.id, id)).get();
  },

  create(accountId: string, input: CreateCueInput): Cue {
    const db = getDb();
    const id = nanoid();
    db.insert(cues)
      .values({
        id,
        accountId,
        projectId: input.projectId,
        sourceWorkspaceId: input.sourceWorkspaceId ?? null,
        kind: input.kind ?? "note",
        status: input.status ?? "inbox",
        title: input.title?.trim() || null,
        content: input.content.trim(),
        isPinned: input.isPinned ?? false,
        sortOrder: input.sortOrder ?? 0,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .run();
    return this.findById(id)!;
  },

  update(id: string, input: UpdateCueInput): Cue | undefined {
    const db = getDb();
    const updates: Record<string, unknown> = {
      ...input,
      updatedAt: sql`(unixepoch())`,
    };

    if (input.title !== undefined) updates.title = input.title?.trim() || null;
    if (input.content !== undefined) updates.content = input.content.trim();
    if (input.metadata !== undefined) {
      updates.metadata = input.metadata ? JSON.stringify(input.metadata) : null;
    }

    db.update(cues).set(updates).where(eq(cues.id, id)).run();
    return this.findById(id);
  },

  delete(id: string): void {
    const db = getDb();
    db.delete(cues).where(eq(cues.id, id)).run();
  },
};
