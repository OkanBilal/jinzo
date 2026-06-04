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

**Seed runner**:
Initial data seeding is *not* a domain module. It lives in `src/main/db/seeds/` as a versioned, idempotent runner: each `v{N}.ts` exports `run(db)`, the runner tracks `appSettings.seedVersion`, and `db/client.ts` invokes `runSeeds(db)` automatically at database init. The renderer plays no part. There is intentionally no `src/main/modules/seed/` — an earlier IPC-driven seed module was vestigial and was removed. Fixtures live in `src/main/db/data/`; v1.ts imports them.
_Avoid_: re-introducing an `api.seed.*` IPC surface, putting seed code under `db/queries/` (the directory no longer exists), or routing seeding through a domain module. See ADR-0003.

## Aggregate modules

### workspace

The `workspace` module owns five tables: `workspaces`, `workspace_activity`, `workspace_diffs`, `reviews`, `review_findings`. They were previously five separate modules; consolidated because they always travel together (no cross-workspace consumer of the satellites — `pulse` doesn't read them, `stats` joins `workspace_diffs` directly via its own repo, every renderer consumer is workspace-scoped).

IPC channels live under one namespace: `workspace:get*`, `workspace:getActivity`, `workspace:logActivity`, `workspace:getLatestDiff`, `workspace:listReviews`, `workspace:listFindings`, etc. The renderer has one `workspaceApi.ts` with split RTK Query tag types (`Workspace`, `WorkspaceActivity`, `WorkspaceDiff`, `WorkspaceReview`, `WorkspaceFinding`) so UI sections still refresh independently.

Cross-module writers (drivers, run-session, guards, mains-tools) import a single named function — `logWorkspaceActivity` — from the module's barrel, not the full service surface.
_Avoid_: re-splitting into `workspaces` + `workspaceActivity` + `workspaceDiffs` + `reviews` + `reviewFindings`. See ADR-0001.

### connections

The `connections` module owns three tables: `connections`, `connection_tokens`, `connection_states`. They were previously three separate modules; consolidated because the seam between them was already leaking — `connections.service` imported `decryptSecrets` from the credentials utils, `sync/sync.connection-utils.ts` had grown a full duplicate of `getConnectionWithSecrets`, and `connectionStates.service` was a 46-line pass-through. The `connection_resources` table is deliberately *out* of the aggregate; it is read by `projects.repo` directly (same shape as `stats` joining `workspace_diffs`).

IPC channels live under one namespace: the existing `connections:*` channels stay, plus `connections:listStates` and `connections:updateState` (formerly `connectionStates:*`). The renderer has one `connectionsApi.ts` with split RTK Query tag types (`Connection`, `ConnectionState`). The preload collapses to one `window.api.connections` section.

Cross-module readers (`sync`, `guards`) import a single named function — `getConnectionWithSecrets` — from the module's barrel. The crypto helpers (`encryptSecrets`, `decryptSecrets`, `createTokenHash`, `parseProviderCredentials`, `parseConnectionMetadata`) live in `connections.utils.ts` as an internal seam — private to the module, used by its own tests, not re-exported from `index.ts`.
_Avoid_: re-splitting into `connections` + `connectionStates` + `connectionCredentials`. Avoid importing crypto helpers across modules — call `getConnectionWithSecrets` instead. See ADR-0002.

### projects

The `projects` module owns two tables: `projects`, `project_resources`. The latter was previously its own `workspaceResources/` module — a half-finished rename (IPC channels were already `projectResources:*`, the table was already `project_resources`, but the folder and exports still said `workspaceResources`). Consolidated because the seam between them was vestigial: every method on `workspaceResourcesService` took `projectId` as its first argument, the table is FK'd to `projects`, and no caller outside `projects.ipc` ever needed the resource methods without already having a `projectId` in hand. Applying the deletion test: removing `workspaceResources/` concentrated its five methods directly onto `projects.service` with no logic loss.

IPC channels live under one namespace: `projects:list`, `projects:get`, `projects:create`, `projects:update`, `projects:delete`, `projects:archive`, plus the resource channels `projects:listResources`, `projects:listAvailableResources`, `projects:addResource`, `projects:removeResource`, `projects:listIssues`. The pre-merge `projects:getAll` / `projects:getById` channels rename to `projects:list` / `projects:get` to match the workspace style. The renderer has one `projectsApi.ts` with split RTK Query tag types (`Projects`, `ProjectResources`, `ProjectIssues`) so UI sections still refresh independently.

The cross-aggregate query `projects:listIssues` (issues linked to a project via `project_resources` → `connection_resources` → `entities`) is orchestrated at the service layer, not joined at the repo: `projects.service.listIssues()` calls `projects.repo.listLinkedResourceIds(projectId)` and then `getIssuesByResourceIds(resourceIds)` from the `entities/` barrel. Each repo stays scoped to its own tables — same shape as the `getConnectionWithSecrets` seam in **connections**. The `LINKABLE_KINDS` allowlist lives in `projects.utils.ts`.
_Avoid_: re-splitting into `projects` + `projectResources` (or re-introducing `workspaceResources/`). Avoid `projects.repo` importing the `entities` or `issues` schema directly — call `getIssuesByResourceIds` from the entities barrel.

## Operations

### Workspace intake

The main-process operation that turns a git repo into a **project** + **workspace** pair. It has two seams. *Acquisition* — how a local repo path is obtained: `folder` (an existing path the user picked), `clone` (cloned from a URL via `gitService.cloneRepo`), or `init` (a fresh empty repo via `gitService.initRepo`). *Intake* — the uniform tail run on that path: worktree-or-direct git import (`importLocalRepo` / `importLocalRepoDirect`) → `findOrCreateProject` → derive the project's `workspacesPath` → assemble the workspace `metadata` → `createWorkspace`. The **intake** is the deep, shared core; the three acquisitions are thin front-ends that feed it a path.

Owned by `workspace.service`, which calls `gitService` and `projectsService` (same cross-service shape as `projects.service.listIssues` reaching the `entities` barrel). The worktree-vs-direct ordering difference lives entirely behind the intake seam: the worktree path lands under `worktrees/{projectName}/`, so it must `findOrCreateProject` *before* the import; the direct path imports first and reads `originUrl`/`baseBranch` off the result. `init` stays direct-only (a brand-new repo lives at its real path); `folder` and `clone` honor `appSettings.enableWorktrees`. The renderer keeps only the picker invocation, navigation, toast, and modal state.
_Avoid_: re-inlining the find-or-create-project / `metadata` / `createWorkspace` tail at call sites (it was duplicated 5× across `use-sidebar-actions.ts`), orchestrating the git → projects → workspace sequence from the renderer, or string-deriving `workspacesPath` outside the intake.

## Flagged ambiguities

- "ServiceResponse" was historically defined ~27 times across `src/main/modules/*/dto.ts` in two structurally incompatible shapes (discriminated union vs optional-fields object). Resolved: the discriminated union is canonical; every module now re-exports the canonical type (no remaining bespoke envelopes).
- `sync` previously carried partial `SyncJobResult` data on its failure branch. Resolved: `success` now means "the orchestration completed" (per-item failures live in `data.errors` count), `fail("Sync job failed")` only when the orchestration itself throws. The information that used to live on the failure-branch data was a misleading "errors=1, total=0" placeholder; nothing real was lost.
- `space` previously carried per-field validation errors as `errors: Record<string, string>` on its failure branch. Resolved: validation errors are flattened into the `error: string` as `field: message; field: message`. No renderer consumed the structured map; behavior is preserved at the user-visible boundary.
