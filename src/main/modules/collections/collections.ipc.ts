import { CHANNELS } from "../../../shared/ipc-kit/channels";
import { handle } from "../../ipc-kit/handle";
import { ipcMain } from "../../ipc-kit/ipc-main";
import type {
  ListCollectionsOptions,
  ListCollectionSourcesOptions,
  RemoveCollectionSourcePayload,
} from "./collections.dto";
import { collectionsService } from "./collections.service";

export function registerCollectionsIpc(): void {
  ipcMain.handle(
    CHANNELS.collections.list,
    handle((options: ListCollectionsOptions) => collectionsService.list(options)),
  );
  ipcMain.handle(
    CHANNELS.collections.get,
    handle((id: string) => collectionsService.get(id)),
  );
  ipcMain.handle(
    CHANNELS.collections.create,
    handle((payload: unknown) => collectionsService.create(payload)),
  );
  ipcMain.handle(
    CHANNELS.collections.update,
    handle((id: string, payload: unknown) => collectionsService.update(id, payload)),
  );
  ipcMain.handle(
    CHANNELS.collections.archive,
    handle((id: string) => collectionsService.archive(id)),
  );
  ipcMain.handle(
    CHANNELS.collections.unarchive,
    handle((id: string) => collectionsService.unarchive(id)),
  );
  ipcMain.handle(
    CHANNELS.collections.remove,
    handle((id: string) => collectionsService.remove(id)),
  );
  ipcMain.handle(
    CHANNELS.collections.listSources,
    handle((options: ListCollectionSourcesOptions) =>
      collectionsService.listSources(options),
    ),
  );
  ipcMain.handle(
    CHANNELS.collections.addSource,
    handle((payload: unknown) => collectionsService.addSource(payload)),
  );
  ipcMain.handle(
    CHANNELS.collections.removeSource,
    handle((payload: RemoveCollectionSourcePayload) =>
      collectionsService.removeSource(payload),
    ),
  );
}

export function unregisterCollectionsIpc(): void {
  Object.values(CHANNELS.collections).forEach((channel) =>
    ipcMain.removeHandler(channel),
  );
}
