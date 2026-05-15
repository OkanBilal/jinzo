import { ipcMain } from "electron";
import { entitiesService } from "./entities.service";
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
  // Signal channels
  SIGNALS_GET_ALL: "signals:getAll",
  SIGNALS_GET_BY_ID: "signals:getById",
  SIGNALS_CREATE: "signals:create",
  SIGNALS_UPDATE: "signals:update",
  SIGNALS_DELETE: "signals:delete",
} as const;

// ─────────────────────────────────────────────────────────────
// Register Handlers
// ─────────────────────────────────────────────────────────────
export function registerEntitiesHandlers(): void {
  // Entity handlers
  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_GET_ALL,
    async (_event, options: EntityQueryOptions = {}) => {
      return entitiesService.getAll(options);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_GET_BY_ID,
    async (_event, id: string) => {
      return entitiesService.getById(id);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_CREATE,
    async (_event, payload: CreateEntityPayload) => {
      return entitiesService.create(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_UPDATE,
    async (_event, id: string, payload: UpdateEntityPayload) => {
      return entitiesService.update(id, payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_DELETE,
    async (_event, id: string) => {
      return entitiesService.delete(id);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ENTITIES_SEARCH,
    async (_event, query: string, options: SearchOptions = {}) => {
      return entitiesService.search(query, options);
    }
  );

  // Task handlers
  ipcMain.handle(
    IPC_CHANNELS.TASKS_GET_ALL,
    async (_event, options: TaskQueryOptions = {}) => {
      return entitiesService.getAllTasks(options);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASKS_GET_BY_ID,
    async (_event, entityId: string) => {
      return entitiesService.getTaskById(entityId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASKS_CREATE,
    async (_event, payload: CreateTaskPayload) => {
      return entitiesService.createTask(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASKS_UPDATE,
    async (_event, entityId: string, payload: UpdateTaskPayload) => {
      return entitiesService.updateTask(entityId, payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASKS_DELETE,
    async (_event, entityId: string) => {
      return entitiesService.deleteTask(entityId);
    }
  );

  // Issue handlers
  ipcMain.handle(
    IPC_CHANNELS.ISSUES_GET_ALL,
    async (_event, options: IssueQueryOptions = {}) => {
      return entitiesService.getAllIssues(options);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ISSUES_GET_BY_ID,
    async (_event, entityId: string) => {
      return entitiesService.getIssueById(entityId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ISSUES_CREATE,
    async (_event, payload: CreateIssuePayload) => {
      return entitiesService.createIssue(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ISSUES_UPDATE,
    async (_event, entityId: string, payload: UpdateIssuePayload) => {
      return entitiesService.updateIssue(entityId, payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ISSUES_DELETE,
    async (_event, entityId: string) => {
      return entitiesService.deleteIssue(entityId);
    }
  );

  // Signal handlers
  ipcMain.handle(
    IPC_CHANNELS.SIGNALS_GET_ALL,
    async (_event, options: SignalQueryOptions = {}) => {
      return entitiesService.getAllSignals(options);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SIGNALS_GET_BY_ID,
    async (_event, entityId: string) => {
      return entitiesService.getSignalById(entityId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SIGNALS_CREATE,
    async (_event, payload: CreateSignalPayload) => {
      return entitiesService.createSignal(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SIGNALS_UPDATE,
    async (_event, entityId: string, payload: UpdateSignalPayload) => {
      return entitiesService.updateSignal(entityId, payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SIGNALS_DELETE,
    async (_event, entityId: string) => {
      return entitiesService.deleteSignal(entityId);
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
