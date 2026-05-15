import { ipcMain } from "electron";
import { skillsMarketplaceService } from "./skillsMarketplace.service";
import type { ListArgs, SearchArgs, SkillRef } from "./skillsMarketplace.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

export function registerSkillsMarketplaceIpc(): void {
  ipcMain.handle(CHANNELS.skillsMarketplace.list, async (_, args: ListArgs = {}) => {
    return skillsMarketplaceService.list(args);
  });

  ipcMain.handle(CHANNELS.skillsMarketplace.search, async (_, args: SearchArgs) => {
    return skillsMarketplaceService.search(args);
  });

  ipcMain.handle(CHANNELS.skillsMarketplace.curated, async () => {
    return skillsMarketplaceService.curated();
  });

  ipcMain.handle(CHANNELS.skillsMarketplace.detail, async (_, ref: SkillRef) => {
    return skillsMarketplaceService.detail(ref);
  });

  ipcMain.handle(CHANNELS.skillsMarketplace.audit, async (_, ref: SkillRef) => {
    return skillsMarketplaceService.audit(ref);
  });
}

export function unregisterSkillsMarketplaceIpc(): void {
  [
    CHANNELS.skillsMarketplace.list,
    CHANNELS.skillsMarketplace.search,
    CHANNELS.skillsMarketplace.curated,
    CHANNELS.skillsMarketplace.detail,
    CHANNELS.skillsMarketplace.audit,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
