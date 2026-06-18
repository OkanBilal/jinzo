import { ipcMain } from "../../ipc-kit/ipc-main";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import { sshService, type OpenTunnelInput } from "./ssh.service";

export function registerSshIpc(): void {
  ipcMain.handle(CHANNELS.ssh.discoverHosts, async () => {
    return sshService.discoverHosts();
  });
  ipcMain.handle(CHANNELS.ssh.openTunnel, async (_, input: OpenTunnelInput) => {
    return sshService.openTunnel(input);
  });
  ipcMain.handle(CHANNELS.ssh.closeTunnel, async (_, id: string) => {
    return sshService.closeTunnel(id);
  });
}

export function unregisterSshIpc(): void {
  ipcMain.removeHandler(CHANNELS.ssh.discoverHosts);
  ipcMain.removeHandler(CHANNELS.ssh.openTunnel);
  ipcMain.removeHandler(CHANNELS.ssh.closeTunnel);
}
