import { ipcMain } from "../../ipc-kit/ipc-main";
import { entitiesService } from "./entities.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
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
// Register Handlers
// ─────────────────────────────────────────────────────────────
export function registerEntitiesHandlers(): void {
  // Entity handlers
  ipcMain.handle(
    CHANNELS.entities.getAll,
    async (_event, options: EntityQueryOptions = {}) => {
      return entitiesService.getAll(options);
    }
  );

  ipcMain.handle(
    CHANNELS.entities.getById,
    async (_event, id: string) => {
      return entitiesService.getById(id);
    }
  );

  ipcMain.handle(
    CHANNELS.entities.create,
    async (_event, payload: CreateEntityPayload) => {
      return entitiesService.create(payload);
    }
  );

  ipcMain.handle(
    CHANNELS.entities.update,
    async (_event, id: string, payload: UpdateEntityPayload) => {
      return entitiesService.update(id, payload);
    }
  );

  ipcMain.handle(
    CHANNELS.entities.delete,
    async (_event, id: string) => {
      return entitiesService.delete(id);
    }
  );

  ipcMain.handle(
    CHANNELS.entities.search,
    async (_event, query: string, options: SearchOptions = {}) => {
      return entitiesService.search(query, options);
    }
  );

  // Task handlers
  ipcMain.handle(
    CHANNELS.tasks.getAll,
    async (_event, options: TaskQueryOptions = {}) => {
      return entitiesService.getAllTasks(options);
    }
  );

  ipcMain.handle(
    CHANNELS.tasks.getById,
    async (_event, entityId: string) => {
      return entitiesService.getTaskById(entityId);
    }
  );

  ipcMain.handle(
    CHANNELS.tasks.create,
    async (_event, payload: CreateTaskPayload) => {
      return entitiesService.createTask(payload);
    }
  );

  ipcMain.handle(
    CHANNELS.tasks.update,
    async (_event, entityId: string, payload: UpdateTaskPayload) => {
      return entitiesService.updateTask(entityId, payload);
    }
  );

  ipcMain.handle(
    CHANNELS.tasks.delete,
    async (_event, entityId: string) => {
      return entitiesService.deleteTask(entityId);
    }
  );

  // Issue handlers
  ipcMain.handle(
    CHANNELS.issues.getAll,
    async (_event, options: IssueQueryOptions = {}) => {
      return entitiesService.getAllIssues(options);
    }
  );

  ipcMain.handle(
    CHANNELS.issues.getById,
    async (_event, entityId: string) => {
      return entitiesService.getIssueById(entityId);
    }
  );

  ipcMain.handle(
    CHANNELS.issues.create,
    async (_event, payload: CreateIssuePayload) => {
      return entitiesService.createIssue(payload);
    }
  );

  ipcMain.handle(
    CHANNELS.issues.update,
    async (_event, entityId: string, payload: UpdateIssuePayload) => {
      return entitiesService.updateIssue(entityId, payload);
    }
  );

  ipcMain.handle(
    CHANNELS.issues.delete,
    async (_event, entityId: string) => {
      return entitiesService.deleteIssue(entityId);
    }
  );

  // Signal handlers
  ipcMain.handle(
    CHANNELS.signals.getAll,
    async (_event, options: SignalQueryOptions = {}) => {
      return entitiesService.getAllSignals(options);
    }
  );

  ipcMain.handle(
    CHANNELS.signals.getById,
    async (_event, entityId: string) => {
      return entitiesService.getSignalById(entityId);
    }
  );

  ipcMain.handle(
    CHANNELS.signals.create,
    async (_event, payload: CreateSignalPayload) => {
      return entitiesService.createSignal(payload);
    }
  );

  ipcMain.handle(
    CHANNELS.signals.update,
    async (_event, entityId: string, payload: UpdateSignalPayload) => {
      return entitiesService.updateSignal(entityId, payload);
    }
  );

  ipcMain.handle(
    CHANNELS.signals.delete,
    async (_event, entityId: string) => {
      return entitiesService.deleteSignal(entityId);
    }
  );

}

// ─────────────────────────────────────────────────────────────
// Unregister Handlers
// ─────────────────────────────────────────────────────────────
export function unregisterEntitiesHandlers(): void {
  [
    CHANNELS.entities.getAll,
    CHANNELS.entities.getById,
    CHANNELS.entities.create,
    CHANNELS.entities.update,
    CHANNELS.entities.delete,
    CHANNELS.entities.search,
    CHANNELS.tasks.getAll,
    CHANNELS.tasks.getById,
    CHANNELS.tasks.create,
    CHANNELS.tasks.update,
    CHANNELS.tasks.delete,
    CHANNELS.issues.getAll,
    CHANNELS.issues.getById,
    CHANNELS.issues.create,
    CHANNELS.issues.update,
    CHANNELS.issues.delete,
    CHANNELS.signals.getAll,
    CHANNELS.signals.getById,
    CHANNELS.signals.create,
    CHANNELS.signals.update,
    CHANNELS.signals.delete,
  ].forEach((channel) => ipcMain.removeHandler(channel));
  console.log("Entities IPC handlers unregistered");
}
