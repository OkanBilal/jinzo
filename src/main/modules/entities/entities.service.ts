import { v4 as uuidv4 } from "uuid";
import { entitiesRepo } from "./entities.repo";
import type {
  CreateEntityPayload,
  UpdateEntityPayload,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateIssuePayload,
  UpdateIssuePayload,
  EntityQueryOptions,
  TaskQueryOptions,
  IssueQueryOptions,
  SearchOptions,
  ServiceResponse,
} from "./entities.dto";

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
      return { success: true, data: items };
    } catch (error) {
      console.error("Error fetching entities:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async getById(id: string): Promise<ServiceResponse<unknown>> {
    try {
      const item = await entitiesRepo.findById(id);
      return { success: true, data: item };
    } catch (error) {
      console.error("Error fetching entity:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async create(payload: CreateEntityPayload): Promise<ServiceResponse<unknown>> {
    try {
      const id = uuidv4();
      const created = await entitiesRepo.insert(id, payload);
      return { success: true, data: created };
    } catch (error) {
      console.error("Error creating entity:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async update(id: string, payload: UpdateEntityPayload): Promise<ServiceResponse<unknown>> {
    try {
      const updated = await entitiesRepo.update(id, payload);
      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating entity:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await entitiesRepo.softDelete(id);
      return { success: true };
    } catch (error) {
      console.error("Error deleting entity:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async search(query: string, options: SearchOptions = {}): Promise<ServiceResponse<unknown[]>> {
    try {
      const items = await entitiesRepo.search(query, options);
      return { success: true, data: items };
    } catch (error) {
      console.error("Error searching entities:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Task Operations
  // ─────────────────────────────────────────────────────────────
  async getAllTasks(options: TaskQueryOptions = {}): Promise<ServiceResponse<unknown[]>> {
    try {
      const items = await entitiesRepo.findAllTasks(options);
      return { success: true, data: items };
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async getTaskById(entityId: string): Promise<ServiceResponse<unknown>> {
    try {
      const item = await entitiesRepo.findTaskById(entityId);
      return { success: true, data: item };
    } catch (error) {
      console.error("Error fetching task:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async createTask(payload: CreateTaskPayload): Promise<ServiceResponse<unknown>> {
    try {
      const entityId = uuidv4();
      const created = await entitiesRepo.insertTask(entityId, payload);
      return { success: true, data: created };
    } catch (error) {
      console.error("Error creating task:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async updateTask(entityId: string, payload: UpdateTaskPayload): Promise<ServiceResponse<unknown>> {
    try {
      const updated = await entitiesRepo.updateTask(entityId, payload);
      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating task:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async deleteTask(entityId: string): Promise<ServiceResponse<void>> {
    try {
      await entitiesRepo.softDelete(entityId);
      return { success: true };
    } catch (error) {
      console.error("Error deleting task:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Issue Operations
  // ─────────────────────────────────────────────────────────────
  async getAllIssues(options: IssueQueryOptions = {}): Promise<ServiceResponse<unknown[]>> {
    try {
      const items = await entitiesRepo.findAllIssues(options);
      return { success: true, data: items };
    } catch (error) {
      console.error("Error fetching issues:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async getIssueById(entityId: string): Promise<ServiceResponse<unknown>> {
    try {
      const item = await entitiesRepo.findIssueById(entityId);
      return { success: true, data: item };
    } catch (error) {
      console.error("Error fetching issue:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async createIssue(payload: CreateIssuePayload): Promise<ServiceResponse<unknown>> {
    try {
      const entityId = uuidv4();
      const created = await entitiesRepo.insertIssue(entityId, payload);
      return { success: true, data: created };
    } catch (error) {
      console.error("Error creating issue:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async updateIssue(entityId: string, payload: UpdateIssuePayload): Promise<ServiceResponse<unknown>> {
    try {
      const updated = await entitiesRepo.updateIssue(entityId, payload);
      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating issue:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  async deleteIssue(entityId: string): Promise<ServiceResponse<void>> {
    try {
      await entitiesRepo.softDelete(entityId);
      return { success: true };
    } catch (error) {
      console.error("Error deleting issue:", error);
      return { success: false, error: (error as Error).message };
    }
  },

};
