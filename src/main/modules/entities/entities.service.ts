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
//
// Throw-style: methods return plain values and throw on failure; the
// ServiceResponse envelope is applied by handle() at the IPC seam.
// Single-item reads return null for absence (see CONTEXT.md
// "absence rule").
// ─────────────────────────────────────────────────────────────
export const entitiesService = {
  // ─────────────────────────────────────────────────────────────
  // Entity Operations
  // ─────────────────────────────────────────────────────────────
  async getAll(options: EntityQueryOptions = {}): Promise<unknown[]> {
    return entitiesRepo.findAll(options);
  },

  async getById(id: string): Promise<unknown> {
    return (await entitiesRepo.findById(id)) ?? null;
  },

  async create(payload: CreateEntityPayload): Promise<unknown> {
    return entitiesRepo.insert(nanoid(), payload);
  },

  async update(id: string, payload: UpdateEntityPayload): Promise<unknown> {
    return entitiesRepo.update(id, payload);
  },

  async delete(id: string): Promise<void> {
    await entitiesRepo.softDelete(id);
  },

  async search(query: string, options: SearchOptions = {}): Promise<unknown[]> {
    return entitiesRepo.search(query, options);
  },

  // ─────────────────────────────────────────────────────────────
  // Task Operations
  // ─────────────────────────────────────────────────────────────
  async getAllTasks(options: TaskQueryOptions = {}): Promise<unknown[]> {
    return entitiesRepo.findAllTasks(options);
  },

  async getTaskById(entityId: string): Promise<unknown> {
    return (await entitiesRepo.findTaskById(entityId)) ?? null;
  },

  async createTask(payload: CreateTaskPayload): Promise<unknown> {
    return entitiesRepo.insertTask(nanoid(), payload);
  },

  async updateTask(
    entityId: string,
    payload: UpdateTaskPayload,
  ): Promise<unknown> {
    return entitiesRepo.updateTask(entityId, payload);
  },

  async deleteTask(entityId: string): Promise<void> {
    await entitiesRepo.softDelete(entityId);
  },

  // ─────────────────────────────────────────────────────────────
  // Issue Operations
  // ─────────────────────────────────────────────────────────────
  async getAllIssues(options: IssueQueryOptions = {}): Promise<unknown[]> {
    return entitiesRepo.findAllIssues(options);
  },

  async getIssueById(entityId: string): Promise<unknown> {
    return (await entitiesRepo.findIssueById(entityId)) ?? null;
  },

  async createIssue(payload: CreateIssuePayload): Promise<unknown> {
    return entitiesRepo.insertIssue(nanoid(), payload);
  },

  async updateIssue(
    entityId: string,
    payload: UpdateIssuePayload,
  ): Promise<unknown> {
    return entitiesRepo.updateIssue(entityId, payload);
  },

  async deleteIssue(entityId: string): Promise<void> {
    await entitiesRepo.softDelete(entityId);
  },

  // ─────────────────────────────────────────────────────────────
  // Signal Operations
  // ─────────────────────────────────────────────────────────────
  async getAllSignals(options: SignalQueryOptions = {}): Promise<unknown[]> {
    return entitiesRepo.findAllSignals(options);
  },

  async getSignalById(entityId: string): Promise<unknown> {
    return (await entitiesRepo.findSignalById(entityId)) ?? null;
  },

  async createSignal(payload: CreateSignalPayload): Promise<unknown> {
    return entitiesRepo.insertSignal(nanoid(), payload);
  },

  async updateSignal(
    entityId: string,
    payload: UpdateSignalPayload,
  ): Promise<unknown> {
    return entitiesRepo.updateSignal(entityId, payload);
  },

  async deleteSignal(entityId: string): Promise<void> {
    await entitiesRepo.softDelete(entityId);
  },
};
