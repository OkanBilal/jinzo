# Mains

Shared domain vocabulary for the Mains codebase. Add terms as decisions crystallize during architecture work — keep definitions tight and project-specific.

## Language

### IPC seam

**ServiceResponse**:
The discriminated-union envelope returned by every IPC handler in the main process and unwrapped by the renderer. Either `{ success: true; data: T }` or `{ success: false; error: string }`. The single canonical shape lives in `src/shared/ipc-kit/`; per-module re-exports are temporary during migration.
_Avoid_: response, result, envelope, ServiceResult.

**CHANNELS**:
The single source of truth for IPC channel names, in `src/shared/ipc-kit/channels.ts`. Main, preload, and renderer all reference values from this map (e.g. `CHANNELS.account.get`) instead of typing the channel string literally. A typo at any site is a compile-time error and a renamed channel is a single edit. The map is grouped by namespace (the part before the colon) so adding a channel means adding one field to one object.
_Avoid_: channel string literals, magic strings, per-module CHANNELS consts.

**ok / fail**:
The two constructors for a **ServiceResponse**. Handlers should build envelopes via `ok(data)` and `fail(message)` rather than literal objects, so the envelope shape stays in one place. (Migrating handlers from literals to constructors is deferred to a follow-up — current handlers still construct `{ success: true, data }` literally.)
_Avoid_: success(), error(), wrap().

**assertOk / assertFail / unwrap**:
Test- and consumer-side companions to **ServiceResponse**. `assertOk(r)` and `assertFail(r)` are TypeScript assertion functions that narrow the union and throw on the wrong branch — used at test boundaries to replace `expect(r.success).toBe(...)` patterns. `unwrap(r)` returns `r.data` on success and throws on failure — used inside renderer `transformResponse` calls where baseApi has already short-circuited the failure case.
_Avoid_: expect-success, ok-or-throw, getData.

## Relationships

- Every IPC handler returns exactly one **ServiceResponse**.
- A **ServiceResponse** is constructed only via **ok** or **fail**.

## Module layout

Each `src/main/modules/{name}/` follows a 6-file layout: `ipc.ts → service.ts → repo.ts → dto.ts → validation.ts → index.ts`. Earlier versions had a `controller.ts` between `ipc.ts` and `service.ts` — it was a pure pass-through across all 26 modules and has been removed. `ipc.ts` calls `service` directly; argument unpacking lives at the ipc call site when needed.

A module folder may own **more than one table**. The 6-file layout is per module, not per table. When several tables form one conceptual aggregate (see **workspace** below), they live in one folder under the flat 6-file shape, with each layer's file containing all tables' code.

## Aggregate modules

### workspace

The `workspace` module owns five tables: `workspaces`, `workspace_activity`, `workspace_diffs`, `reviews`, `review_findings`. They were previously five separate modules; consolidated because they always travel together (no cross-workspace consumer of the satellites — `pulse` doesn't read them, `stats` joins `workspace_diffs` directly via its own repo, every renderer consumer is workspace-scoped).

IPC channels live under one namespace: `workspace:get*`, `workspace:getActivity`, `workspace:logActivity`, `workspace:getLatestDiff`, `workspace:listReviews`, `workspace:listFindings`, etc. The renderer has one `workspaceApi.ts` with split RTK Query tag types (`Workspace`, `WorkspaceActivity`, `WorkspaceDiff`, `WorkspaceReview`, `WorkspaceFinding`) so UI sections still refresh independently.

Cross-module writers (drivers, run-session, guards, mains-tools) import a single named function — `logWorkspaceActivity` — from the module's barrel, not the full service surface.
_Avoid_: re-splitting into `workspaces` + `workspaceActivity` + `workspaceDiffs` + `reviews` + `reviewFindings`. See ADR-0001.

## Flagged ambiguities

- "ServiceResponse" was historically defined ~27 times across `src/main/modules/*/dto.ts` in two structurally incompatible shapes (discriminated union vs optional-fields object). Resolved: the discriminated union is canonical; every module now re-exports the canonical type (no remaining bespoke envelopes).
- `sync` previously carried partial `SyncJobResult` data on its failure branch. Resolved: `success` now means "the orchestration completed" (per-item failures live in `data.errors` count), `fail("Sync job failed")` only when the orchestration itself throws. The information that used to live on the failure-branch data was a misleading "errors=1, total=0" placeholder; nothing real was lost.
- `space` previously carried per-field validation errors as `errors: Record<string, string>` on its failure branch. Resolved: validation errors are flattened into the `error: string` as `field: message; field: message`. No renderer consumed the structured map; behavior is preserved at the user-visible boundary.
