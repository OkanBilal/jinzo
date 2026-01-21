import { registerEntityHandlers, unregisterEntityHandlers } from "./entity";
import { registerTaskHandlers, unregisterTaskHandlers } from "./tasks";
import { registerIssueHandlers, unregisterIssueHandlers } from "./issues";
import { registerPlaylistHandlers, unregisterPlaylistHandlers } from "./playlists";

export function registerEntitiesHandlers() {
  registerEntityHandlers();
  registerTaskHandlers();
  registerIssueHandlers();
  registerPlaylistHandlers();
  console.log("Entities IPC handlers registered");
}

export function unregisterEntitiesHandlers() {
  unregisterEntityHandlers();
  unregisterTaskHandlers();
  unregisterIssueHandlers();
  unregisterPlaylistHandlers();
  console.log("Entities IPC handlers unregistered");
}
