import { ipcMain } from "electron";
import { skillsMarketplaceService } from "./skillsMarketplace.service";
import type { ListArgs, SearchArgs, SkillRef } from "./skillsMarketplace.dto";

const CHANNELS = {
  LIST: "skillsMarketplace:list",
  SEARCH: "skillsMarketplace:search",
  CURATED: "skillsMarketplace:curated",
  DETAIL: "skillsMarketplace:detail",
  AUDIT: "skillsMarketplace:audit",
} as const;

export function registerSkillsMarketplaceIpc(): void {
  ipcMain.handle(CHANNELS.LIST, async (_, args: ListArgs = {}) => {
    return skillsMarketplaceService.list(args);
  });

  ipcMain.handle(CHANNELS.SEARCH, async (_, args: SearchArgs) => {
    return skillsMarketplaceService.search(args);
  });

  ipcMain.handle(CHANNELS.CURATED, async () => {
    return skillsMarketplaceService.curated();
  });

  ipcMain.handle(CHANNELS.DETAIL, async (_, ref: SkillRef) => {
    return skillsMarketplaceService.detail(ref);
  });

  ipcMain.handle(CHANNELS.AUDIT, async (_, ref: SkillRef) => {
    return skillsMarketplaceService.audit(ref);
  });
}

export function unregisterSkillsMarketplaceIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
