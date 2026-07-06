import {
  ok,
  fail,
  type ServiceResponse,
} from "../../shared/ipc-kit/service-response";

/**
 * Wrap a throw-style service function into an `ipcMain.handle` handler that
 * returns the ServiceResponse envelope: the resolved value becomes `ok(data)`,
 * a throw becomes `fail(message)` (logged here).
 *
 * This is where the envelope lives for throw-style modules — services return
 * plain `T` and throw on failure; only the IPC seam builds ServiceResponse.
 * The git module pilots this convention (see CONTEXT.md "git module");
 * other modules still construct envelopes in their services.
 *
 * The first handler parameter (the Electron event / WS invoke context) is
 * dropped — handlers that need it stay hand-written.
 */
export function handle<Args extends unknown[], T>(
  fn: (...args: Args) => T | Promise<T>,
): (ctx: unknown, ...args: Args) => Promise<ServiceResponse<T>> {
  return async (_ctx, ...args) => {
    try {
      return ok(await fn(...args));
    } catch (error) {
      console.error("[ipc] handler failed:", error);
      return fail(error instanceof Error ? error.message : String(error));
    }
  };
}
