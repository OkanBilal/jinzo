import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { nanoid } from "nanoid";
import { entitiesRepo } from "./entities.repo";
import type {
  CreateEntityPayload,
  UpdateEntityPayload,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateIssuePayload,
  UpdateIssuePayload,
  CreateSignalPayload,
  UpdateSignalPayload,
  EntityQueryOptions,
  TaskQueryOptions,
  IssueQueryOptions,
  SignalQueryOptions,
  SearchOptions,
  ServiceResponse,
} from "./entities.dto";

// ─────────────────────────────────────────────────────────────
// Cross-module helper: fetch issues whose entity is linked to any of
// the given connection_resources. The single named seam used by the
// `projects` aggregate when answering `projects:listIssues`.
// ─────────────────────────────────────────────────────────────
export async function getIssuesByResourceIds(resourceIds: string[]) {
  return entitiesRepo.findIssuesByResourceIds(resourceIds);
}

// ─────────────────────────────────────────────────────────────
// Entities Service
// ─────────────────────────────────────────────────────────────
export const entitiesService = {
  // ─────────────────────────────────────────────────────────────
  // Entity Operations
  // ─────────────────────────────────────────────────────────────
  async getAll(options: EntityQueryOptions = {}): Promise<ServiceResponse<unknown[]>> {
    try {
      const items = await entitiesRepo.findAll(options);
      return ok(items);
    } catch (error) {
      console.error("Error fetching entities:", error);
      return fail((error as Error).message);
    }
  },

  async getById(id: string): Promise<ServiceResponse<unknown>> {
    try {
      const item = await entitiesRepo.findById(id);
      return ok(item);
    } catch (error) {
      console.error("Error fetching entity:", error);
      return fail((error as Error).message);
    }
  },

  async create(payload: CreateEntityPayload): Promise<ServiceResponse<unknown>> {
    try {
      const id = nanoid();
      const created = await entitiesRepo.insert(id, payload);
      return ok(created);
    } catch (error) {
      console.error("Error creating entity:", error);
      return fail((error as Error).message);
    }
  },

  async update(id: string, payload: UpdateEntityPayload): Promise<ServiceResponse<unknown>> {
    try {
      const updated = await entitiesRepo.update(id, payload);
      return ok(updated);
    } catch (error) {
      console.error("Error updating entity:", error);
      return fail((error as Error).message);
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await entitiesRepo.softDelete(id);
      return ok(undefined);
    } catch (error) {
      console.error("Error deleting entity:", error);
      return fail((error as Error).message);
    }
  },

  async search(query: string, options: SearchOptions = {}): Promise<ServiceResponse<unknown[]>> {
    try {
      const items = await entitiesRepo.search(query, options);
      return ok(items);
    } catch (error) {
      console.error("Error searching entities:", error);
      return fail((error as Error).message);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Task Operations
  // ─────────────────────────────────────────────────────────────
  async getAllTasks(options: TaskQueryOptions = {}): Promise<ServiceResponse<unknown[]>> {
    try {
      const items = await entitiesRepo.findAllTasks(options);
      return ok(items);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return fail((error as Error).message);
    }
  },

  async getTaskById(entityId: string): Promise<ServiceResponse<unknown>> {
    try {
      const item = await entitiesRepo.findTaskById(entityId);
      return ok(item);
    } catch (error) {
      console.error("Error fetching task:", error);
      return fail((error as Error).message);
    }
  },

  async createTask(payload: CreateTaskPayload): Promise<ServiceResponse<unknown>> {
    try {
      const entityId = nanoid();
      const created = await entitiesRepo.insertTask(entityId, payload);
      return ok(created);
    } catch (error) {
      console.error("Error creating task:", error);
      return fail((error as Error).message);
    }
  },

  async updateTask(entityId: string, payload: UpdateTaskPayload): Promise<ServiceResponse<unknown>> {
    try {
      const updated = await entitiesRepo.updateTask(entityId, payload);
      return ok(updated);
    } catch (error) {
      console.error("Error updating task:", error);
      return fail((error as Error).message);
    }
  },

  async deleteTask(entityId: string): Promise<ServiceResponse<void>> {
    try {
      await entitiesRepo.softDelete(entityId);
      return ok(undefined);
    } catch (error) {
      console.error("Error deleting task:", error);
      return fail((error as Error).message);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Issue Operations
  // ─────────────────────────────────────────────────────────────
  async getAllIssues(options: IssueQueryOptions = {}): Promise<ServiceResponse<unknown[]>> {
    try {
      const items = await entitiesRepo.findAllIssues(options);
      return ok(items);
    } catch (error) {
      console.error("Error fetching issues:", error);
      return fail((error as Error).message);
    }
  },

  async getIssueById(entityId: string): Promise<ServiceResponse<unknown>> {
    try {
      const item = await entitiesRepo.findIssueById(entityId);
      return ok(item);
    } catch (error) {
      console.error("Error fetching issue:", error);
      return fail((error as Error).message);
    }
  },

  async createIssue(payload: CreateIssuePayload): Promise<ServiceResponse<unknown>> {
    try {
      const entityId = nanoid();
      const created = await entitiesRepo.insertIssue(entityId, payload);
      return ok(created);
    } catch (error) {
      console.error("Error creating issue:", error);
      return fail((error as Error).message);
    }
  },

  async updateIssue(entityId: string, payload: UpdateIssuePayload): Promise<ServiceResponse<unknown>> {
    try {
      const updated = await entitiesRepo.updateIssue(entityId, payload);
      return ok(updated);
    } catch (error) {
      console.error("Error updating issue:", error);
      return fail((error as Error).message);
    }
  },

  async deleteIssue(entityId: string): Promise<ServiceResponse<void>> {
    try {
      await entitiesRepo.softDelete(entityId);
      return ok(undefined);
    } catch (error) {
      console.error("Error deleting issue:", error);
      return fail((error as Error).message);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Signal Operations
  // ─────────────────────────────────────────────────────────────
  async getAllSignals(options: SignalQueryOptions = {}): Promise<ServiceResponse<unknown[]>> {
    try {
      const items = await entitiesRepo.findAllSignals(options);
      return ok(items);
    } catch (error) {
      console.error("Error fetching signals:", error);
      return fail((error as Error).message);
    }
  },

  async getSignalById(entityId: string): Promise<ServiceResponse<unknown>> {
    try {
      const item = await entitiesRepo.findSignalById(entityId);
      return ok(item);
    } catch (error) {
      console.error("Error fetching signal:", error);
      return fail((error as Error).message);
    }
  },

  async createSignal(payload: CreateSignalPayload): Promise<ServiceResponse<unknown>> {
    try {
      const entityId = nanoid();
      const created = await entitiesRepo.insertSignal(entityId, payload);
      return ok(created);
    } catch (error) {
      console.error("Error creating signal:", error);
      return fail((error as Error).message);
    }
  },

  async updateSignal(entityId: string, payload: UpdateSignalPayload): Promise<ServiceResponse<unknown>> {
    try {
      const updated = await entitiesRepo.updateSignal(entityId, payload);
      return ok(updated);
    } catch (error) {
      console.error("Error updating signal:", error);
      return fail((error as Error).message);
    }
  },

  async deleteSignal(entityId: string): Promise<ServiceResponse<void>> {
    try {
      await entitiesRepo.softDelete(entityId);
      return ok(undefined);
    } catch (error) {
      console.error("Error deleting signal:", error);
      return fail((error as Error).message);
    }
  },

};
