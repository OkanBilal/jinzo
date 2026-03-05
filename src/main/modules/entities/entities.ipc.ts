import { ipcMain } from "electron";
import { entitiesController } from "./entities.controller";
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
// IPC Channel Constants
// ─────────────────────────────────────────────────────────────
const IPC_CHANNELS = {
  // Entity channels
  ENTITIES_GET_ALL: "entities:getAll",
  ENTITIES_GET_BY_ID: "entities:getById",
  ENTITIES_CREATE: "entities:create",
  ENTITIES_UPDATE: "entities:update",
  ENTITIES_DELETE: "entities:delete",
  ENTITIES_SEARCH: "entities:search",
  // Task channels
  TASKS_GET_ALL: "tasks:getAll",
  TASKS_GET_BY_ID: "tasks:getById",
  TASKS_CREATE: "tasks:create",
  TASKS_UPDATE: "tasks:update",
  TASKS_DELETE: "tasks:delete",
  // Issue channels
  ISSUES_GET_ALL: "issues:getAll",
  ISSUES_GET_BY_ID: "issues:getById",
  ISSUES_CREATE: "issues:create",
  ISSUES_UPDATE: "issues:update",
  ISSUES_DELETE: "issues:delete",
} as const;

// ─────────────────────────────────────────────────────────────
// Register Handlers
// ─────────────────────────────────────────────────────────────
export function registerEntitiesHandlers(): void {
  // Entity handlers
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_GET_ALL,
    async (_event, options: EntityQueryOptions = {}) => {
      return entitiesController.getAll(options);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_GET_BY_ID,
    async (_event, id: string) => {
      return entitiesController.getById(id);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_CREATE,
    async (_event, payload: CreateEntityPayload) => {
      return entitiesController.create(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_UPDATE,
    async (_event, id: string, payload: UpdateEntityPayload) => {
      return entitiesController.update(id, payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_DELETE,
    async (_event, id: string) => {
      return entitiesController.delete(id);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_SEARCH,
    async (_event, query: string, options: SearchOptions = {}) => {
      return entitiesController.search(query, options);
    }
  );

  // Task handlers
  ipcMain.handle(
    IPC_CHANNELS.TASKS_GET_ALL,
    async (_event, options: TaskQueryOptions = {}) => {
      return entitiesController.getAllTasks(options);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASKS_GET_BY_ID,
    async (_event, entityId: string) => {
      return entitiesController.getTaskById(entityId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASKS_CREATE,
    async (_event, payload: CreateTaskPayload) => {
      return entitiesController.createTask(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASKS_UPDATE,
    async (_event, entityId: string, payload: UpdateTaskPayload) => {
      return entitiesController.updateTask(entityId, payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASKS_DELETE,
    async (_event, entityId: string) => {
      return entitiesController.deleteTask(entityId);
    }
  );

  // Issue handlers
  ipcMain.handle(
    IPC_CHANNELS.ISSUES_GET_ALL,
    async (_event, options: IssueQueryOptions = {}) => {
      return entitiesController.getAllIssues(options);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ISSUES_GET_BY_ID,
    async (_event, entityId: string) => {
      return entitiesController.getIssueById(entityId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ISSUES_CREATE,
    async (_event, payload: CreateIssuePayload) => {
      return entitiesController.createIssue(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ISSUES_UPDATE,
    async (_event, entityId: string, payload: UpdateIssuePayload) => {
      return entitiesController.updateIssue(entityId, payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ISSUES_DELETE,
    async (_event, entityId: string) => {
      return entitiesController.deleteIssue(entityId);
    }
  );

}

// ─────────────────────────────────────────────────────────────
// Unregister Handlers
// ─────────────────────────────────────────────────────────────
export function unregisterEntitiesHandlers(): void {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
  console.log("Entities IPC handlers unregistered");
}
