import { browserService } from "./browser.service";
import type { BrowserBounds } from "./browser.dto";

export const browserController = {
  attach: (bounds: BrowserBounds) => browserService.attach(bounds),
  detach: () => browserService.detach(),
  destroy: () => browserService.destroy(),
  setBounds: (bounds: BrowserBounds) => browserService.setBounds(bounds),
  setVisible: (visible: boolean) => browserService.setVisible(visible),
  navigate: (url: string) => browserService.navigate(url),
  goBack: () => browserService.goBack(),
  goForward: () => browserService.goForward(),
  reload: () => browserService.reload(),
  stop: () => browserService.stop(),
  setSelectMode: (enabled: boolean) => browserService.setSelectMode(enabled),
  getNavState: () => browserService.getNavState(),
  deleteCapture: (captureName: string) => browserService.deleteCapture(captureName),
};
