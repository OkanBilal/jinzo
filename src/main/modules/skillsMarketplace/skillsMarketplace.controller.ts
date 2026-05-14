import { skillsMarketplaceService } from "./skillsMarketplace.service";
import type { ListArgs, SearchArgs, SkillRef } from "./skillsMarketplace.dto";

export const skillsMarketplaceController = {
  async list(args: ListArgs = {}) {
    return skillsMarketplaceService.list(args);
  },

  async search(args: SearchArgs) {
    return skillsMarketplaceService.search(args);
  },

  async curated() {
    return skillsMarketplaceService.curated();
  },

  async detail(ref: SkillRef) {
    return skillsMarketplaceService.detail(ref);
  },

  async audit(ref: SkillRef) {
    return skillsMarketplaceService.audit(ref);
  },
};
