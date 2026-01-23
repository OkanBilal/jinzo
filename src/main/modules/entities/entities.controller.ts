import { entitiesService } from "./entities.service";
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
} from "./entities.dto";

// ─────────────────────────────────────────────────────────────
// Entities Controller
// ─────────────────────────────────────────────────────────────
export const entitiesController = {
  // Entity Operations
  async getAll(options: EntityQueryOptions = {}) {
    return entitiesService.getAll(options);
  },

  async getById(id: string) {
    return entitiesService.getById(id);
  },

  async create(payload: CreateEntityPayload) {
    return entitiesService.create(payload);
  },

  async update(id: string, payload: UpdateEntityPayload) {
    return entitiesService.update(id, payload);
  },

  async delete(id: string) {
    return entitiesService.delete(id);
  },

  async search(query: string, options: SearchOptions = {}) {
    return entitiesService.search(query, options);
  },

  // Task Operations
  async getAllTasks(options: TaskQueryOptions = {}) {
    return entitiesService.getAllTasks(options);
  },

  async getTaskById(entityId: string) {
    return entitiesService.getTaskById(entityId);
  },

  async createTask(payload: CreateTaskPayload) {
    return entitiesService.createTask(payload);
  },

  async updateTask(entityId: string, payload: UpdateTaskPayload) {
    return entitiesService.updateTask(entityId, payload);
  },

  async deleteTask(entityId: string) {
    return entitiesService.deleteTask(entityId);
  },

  // Issue Operations
  async getAllIssues(options: IssueQueryOptions = {}) {
    return entitiesService.getAllIssues(options);
  },

  async getIssueById(entityId: string) {
    return entitiesService.getIssueById(entityId);
  },

  async createIssue(payload: CreateIssuePayload) {
    return entitiesService.createIssue(payload);
  },

  async updateIssue(entityId: string, payload: UpdateIssuePayload) {
    return entitiesService.updateIssue(entityId, payload);
  },

  async deleteIssue(entityId: string) {
    return entitiesService.deleteIssue(entityId);
  },

  // Playlist Operations
  async getPlaylistItems(playlistEntityId: string) {
    return entitiesService.getPlaylistItems(playlistEntityId);
  },

  async addPlaylistItem(
    playlistEntityId: string,
    itemEntityId: string,
    position?: number
  ) {
    return entitiesService.addPlaylistItem(playlistEntityId, itemEntityId, position);
  },

  async removePlaylistItem(playlistEntityId: string, itemEntityId: string) {
    return entitiesService.removePlaylistItem(playlistEntityId, itemEntityId);
  },

  async reorderPlaylistItem(
    playlistEntityId: string,
    itemEntityId: string,
    newPosition: number
  ) {
    return entitiesService.reorderPlaylistItem(playlistEntityId, itemEntityId, newPosition);
  },
};
