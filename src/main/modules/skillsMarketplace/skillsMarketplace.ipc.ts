import { ipcMain } from "electron";
import { skillsMarketplaceController } from "./skillsMarketplace.controller";
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
    return skillsMarketplaceController.list(args);
  });

  ipcMain.handle(CHANNELS.SEARCH, async (_, args: SearchArgs) => {
    return skillsMarketplaceController.search(args);
  });

  ipcMain.handle(CHANNELS.CURATED, async () => {
    return skillsMarketplaceController.curated();
  });

  ipcMain.handle(CHANNELS.DETAIL, async (_, ref: SkillRef) => {
    return skillsMarketplaceController.detail(ref);
  });

  ipcMain.handle(CHANNELS.AUDIT, async (_, ref: SkillRef) => {
    return skillsMarketplaceController.audit(ref);
  });
}

export function unregisterSkillsMarketplaceIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
