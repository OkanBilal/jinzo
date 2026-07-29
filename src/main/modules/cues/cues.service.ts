import { projectsRepo } from "../projects/projects.repo";
import { cuesRepo } from "./cues.repo";
import { validateCreate, validateUpdate } from "./cues.validation";
import type { CreateCueInput, Cue, UpdateCueInput } from "./cues.dto";

export const cuesService = {
  listByProject(projectId: string): Cue[] {
    if (!projectId) throw new Error("projectId is required");
    return cuesRepo.findByProject(projectId);
  },

  getById(id: string): Cue | null {
    return cuesRepo.findById(id) ?? null;
  },

  async create(accountId: string, input: CreateCueInput): Promise<Cue> {
    const validationError = validateCreate(input);
    if (validationError) throw new Error(validationError);

    const project = await projectsRepo.findById(input.projectId);
    if (!project || project.accountId !== accountId) {
      throw new Error("Project not found");
    }

    return cuesRepo.create(accountId, input);
  },

  update(id: string, input: UpdateCueInput): Cue {
    const validationError = validateUpdate(input);
    if (validationError) throw new Error(validationError);
    if (!cuesRepo.findById(id)) throw new Error("Cue not found");

    const cue = cuesRepo.update(id, input);
    if (!cue) throw new Error("Cue not found");
    return cue;
  },

  delete(id: string): void {
    if (!cuesRepo.findById(id)) throw new Error("Cue not found");
    cuesRepo.delete(id);
  },
};
