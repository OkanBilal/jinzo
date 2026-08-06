# AGENTS.md

This file provides guidance to coding agents (Codex CLI, Claude Code, Copilot CLI, Cursor) when working with code in this repository.

`CONTEXT.md` is the companion document: it holds the shared domain vocabulary (ServiceResponse, handle, aggregate modules, provider adapters, provider variants, transcript rows, run cache) with explicit _Avoid_ rules. Read it before making architectural changes — this file describes *what exists*, CONTEXT.md describes *what the words mean and which shapes are forbidden*.

## Development Commands

```bash
# Start development server
npm start                   # electron-forge start (raises ulimit to 65536)
npm run serve               # start with MAINS_SERVE=1 (backend exposed over WebSocket)
npm run serve:tailscale     # serve + MAINS_TAILSCALE_SERVE=1 (Tailscale HTTPS exposure)
npm run build:web           # build the renderer as a standalone web client → dist-web/

# Database operations
npm run db:generate     # Generate migrations from schema changes
npm run db:push         # Push schema to dev database
npm run db:studio       # Open Drizzle Studio (dev database)
npm run db:studio:runtime  # Open Drizzle Studio (runtime database)
npm run db:clean:dev    # Reset dev database
npm run db:clean:runtime  # Reset runtime database (~/Library/Application Support/mains/)
npm run db:clean:all    # Reset both databases

# Tests & types
npm test                # vitest run (auto-rebuilds better-sqlite3 first)
npm run test:watch      # vitest in watch mode
npm run test:coverage   # vitest with coverage
npm run typecheck       # tsc --noEmit across main, preload, and renderer tsconfigs

# Run a single test file or pattern
npx vitest run path/to/file.test.ts
npx vitest run -t "describes substring"

# Linting
npm run lint            # Run ESLint on src/
npm run lint:fix        # Run ESLint with auto-fix

# Build & Package
npm run package         # Package app for current platform
npm run make            # Create distributable
npm run publish         # Publish via electron-forge

# Codex app-server protocol
npm run codex:protocol:generate  # Regenerate the typed codex app-server protocol
npm run codex:protocol:smoke     # Smoke-test the generated protocol

# Maintenance
npm run clean           # Remove build artifacts (.vite, dist, out, caches)
npm run reset           # Rebuild better-sqlite3 + reset dev database
npm run hard-reset      # Full reset (reset + nuke node_modules + reinstall)
npm run licenses:generate  # Regenerate THIRD-PARTY-NOTICES.txt
```

Tests require `better-sqlite3` to be rebuilt against the local Node ABI — the `test*` scripts handle this automatically, but running `vitest` directly will fail if you skip that step (use `npm rebuild better-sqlite3` first). Tests live next to the file under test as `*.test.ts`; vitest config is `vitest.config.mts`, shared fixtures/factories live in `src/test/`.

## Architecture Overview

Mains is an Electron 41 desktop app (React 19 renderer, SQLite + Drizzle ORM). CommonJS package with ESM Vite configs (`.mjs`). **macOS only** (Apple Silicon and Intel) — Windows and Linux are not supported.

### Process Boundaries

**Main Process** (`src/main/`)
- Entry point: `src/main/index.ts` — initializes database, registers IPC handlers, registers the BrowserWindow event sink, creates the window
- Database client: `src/main/db/client.ts` — singleton with better-sqlite3, Drizzle ORM; runs migrations + seeds at init
- Modules: `src/main/modules/` — domain modules with layered architecture
- IPC plumbing: `src/main/ipc-kit/` — see **IPC Transport** below

**Preload** (`src/preload/index.ts`)
- Exposes `window.api` object with typed IPC methods
- Namespaced by domain: `api.account`, `api.app`, `api.appSettings`, `api.automations`, `api.backendAuth`, `api.browser`, `api.connections`, `api.documents`, `api.entities`, `api.fileExplorer`, `api.gitFlow`, `api.guards`, `api.imageProxy`, `api.issues`, `api.localBackend`, `api.platform`, `api.projects`, `api.providers`, `api.pulse`, `api.runs`, `api.runArtifacts`, `api.runContext`, `api.runTurns`, `api.shell`, `api.signals`, `api.space`, `api.ssh`, `api.stats`, `api.sync`, `api.tasks`, `api.terminal`, `api.toolCalls`, `api.updates`, `api.workspace`
- The `workspace` namespace is an aggregate — it covers workspace lifecycle plus reviews, review findings, diffs, and activity. Connection credentials/states are folded into `api.connections`; project resources and linked issues into `api.projects`.
- **There is no `api.git`.** The `git` module is main-process-internal (see **Git Module**); renderer git effects go through `api.workspace.*`, `api.gitFlow.*`, and `projects:listBranches`.
- After modifying preload, restart dev server to pick up changes

**Renderer** (`src/renderer/`)
- React app with Redux Toolkit, React Router (HashRouter), `@/` alias → `src/renderer/`
- Routes: `/` (default route), `/code[/:workspaceId]` (unified agent workspace — all providers), `/settings`, `/plugins`, `/pulse`, `/relay`
- `/code` hosts every agent provider; which provider it drives comes from the active space's `providerId` column (`claude_code`, `copilot_cli`, `codex`, `cursor`) — switching space via the space picker switches the provider. There are no per-provider routes.
- The space's `mode` column (`developer`, `work`, `chat` — see `src/shared/modes.ts`) selects the UI shape via `src/renderer/lib/mode-config.ts` (`MODE_CONFIGS`), including which route `/` redirects to
- Route table lives in `src/renderer/components/layout/main/main-routes.tsx`; page components in `src/renderer/routes/`

### IPC Transport (`src/main/ipc-kit/`, `src/shared/ipc-kit/`)

The IPC layer is transport-agnostic so the same handlers can serve a local renderer *or* a remote client:

- `ipc-main.ts` — drop-in shim for Electron's `ipcMain` used by every `*.ipc.ts`. Each registration is also recorded in the handler registry. Import `ipcMain` from here, not from `electron`.
- `handler-registry.ts` — channel → handler map, keyed by `"domain:action"`. Handlers keep the `(ctx, ...args)` shape; `ctx` is the Electron `IpcMainInvokeEvent` locally or a synthetic `{ clientId }` over WebSocket. Handlers that genuinely need the Electron event (terminal streaming via `event.sender`) stay on raw `ipcMain` and are not registered.
- `handle.ts` — the wrapper at the IPC seam: resolved value → `ok(data)`, throw → log + `fail(message)`. Every `*.ipc.ts` handler uses it except the handful needing the invoke context (native dialog, terminal streaming, imageProxy signing, localBackend).
- `event-bus.ts` — the single outbound path for main → client events (`emit`), Electron-free. Sinks: `browser-window-sink.ts` (local renderer) and `websocket-sink.ts` (remote clients).
- `ws-server.ts` / `ws-server-host.ts` / `ws-auth.ts` — WebSocket router + in-process host + token auth; wire format in `src/shared/ipc-kit/ws-protocol.ts`.

See `docs/design/remote-backend.md` for the full design.

### Module Architecture (`src/main/modules/`)

Each domain module follows a layered pattern (see `src/main/modules/account/` as reference):

| File | Role |
|------|------|
| `{name}.ipc.ts` | `registerXxxIpc()` / `unregisterXxxIpc()` using the `ipcMain` shim + `handle()` — calls `xxxService` directly |
| `{name}.service.ts` | Object literal with business logic, uses `this` for sibling calls. **Throw-style**: returns plain `T` / `T \| null` and throws on failure. |
| `{name}.repo.ts` | Object literal, calls `getDb()` per method, Drizzle queries. **Module-internal** — never exported from the barrel. |
| `{name}.dto.ts` | Types via `typeof table.$inferSelect`, formatter functions |
| `{name}.validation.ts` | Hand-rolled allowlist validation (no zod/yup) |
| `index.ts` | Barrel exports (service + dto + selected named functions; never the repo) |

**Critical**: All layers are **plain object literals**, never classes. No DI — repos call `getDb()` inline.

**Throw-style, not envelopes.** Services do *not* return `ServiceResponse`. They return plain values and throw; the `ok()`/`fail()` envelope is constructed once at the IPC seam by `handle()`. The **absence rule**: single-item *reads* return `T | null` (absence is a legitimate state); *mutations* whose target is missing throw (`"Workspace not found"`). Error messages travel to the renderer as-is — write messages users can read.

**No controller layer.** Earlier versions had a `{name}.controller.ts` between `ipc.ts` and `service.ts`. It was a pure pass-through and has been removed. Argument unpacking (e.g. `{ projectId, resourceId }` → two args) lives at the `ipc.ts` call site.

**Cross-module access** goes through service methods or named barrel functions (`logWorkspaceActivity`, `recordWorkspaceDiff`, `getConnectionWithSecrets`, `getIssuesByResourceIds`) — never another module's repo.

All modules: `account`, `appSettings`, `automations`, `backendAuth`, `browser`, `connections`, `entities`, `fileExplorer`, `git`, `gitFlow`, `guards`, `imageProxy`, `localBackend`, `projects`, `providers`, `pulse`, `runs`, `space`, `ssh`, `stats`, `sync`, `tailscale`, `terminal`, `tools`, `updates`, `workspace`

Not every module has all six files. Modules that own no tables skip `repo`/`dto` (`guards`, `browser`, `terminal`, `ssh`, `backendAuth`, `localBackend`, `imageProxy`, `gitFlow`), and `git` / `tailscale` have no `ipc.ts` at all (no IPC surface). When adding a module, match a sibling with similar responsibilities rather than blindly copying `account/`.

**Aggregate modules** — one folder owns several tables (details in CONTEXT.md):
- `workspace` → `workspaces`, `workspace_activity`, `workspace_diffs`, `reviews`, `review_findings`
- `connections` → `connections`, `connection_tokens`, `connection_states`
- `projects` → `projects`, `project_resources`

### IPC Convention

Channel format: `"domain:action"` (e.g. `"entities:getAll"`). All channels are defined once in `src/shared/ipc-kit/channels.ts` as a typed map (`CHANNELS.entities.getAll`). Main, preload, and renderer all import and reference values from that map — never type the channel string literally. Adding a channel = one edit; renaming = one edit; typo = compile-time error.

Sites that reference the registry:

1. `src/preload/index.ts` — `ipcRenderer.invoke(CHANNELS.entities.getAll, ...)`
2. `src/main/modules/{name}/{name}.ipc.ts` — `ipcMain.handle(CHANNELS.entities.getAll, ...)`
3. `src/renderer/lib/redux/api/{name}Api.ts` — `{ handler: CHANNELS.entities.getAll }`

Channel namespaces: `account`, `app`, `appSettings`, `automations`, `backendAuth`, `browser`, `connections`, `documents`, `entities`, `fileExplorer`, `gitFlow`, `guards`, `imageProxy`, `issues`, `localBackend`, `projects`, `providers`, `pulse`, `runArtifacts`, `runContext`, `runToolCalls`, `runTurns`, `runs`, `shell`, `signals`, `space`, `ssh`, `stats`, `sync`, `tasks`, `terminal`, `toolCalls`, `updates`, `workspace`.

All IPC responses use the `ServiceResponse<T>` envelope: `{ success: true, data }` or `{ success: false, error }`, built by `ok()` / `fail()` from `src/shared/ipc-kit/service-response.ts`. The renderer unwraps it exactly once, in `ipcBaseQuery` — never in `transformResponse`.

### Data Flow

1. **IPC Communication**: Renderer calls `window.api.namespace.method()` → Preload invokes IPC → handler registry → Main handles
2. **Module Flow**: IPC handler (`handle()`) → Service (throws) → Repository → Database
3. **Redux Integration**: `src/renderer/lib/redux/api/baseApi.ts` wraps IPC in RTK Query with custom `ipcBaseQuery` (no HTTP)
4. **State Management**: RTK Query for server state, Redux slices for UI state (`appSettingsSlice`, `backendsSlice`, `workspaceSlice`)

### Database Schema (`src/main/db/schema.ts`)

Conventions:
- Text primary keys (UUIDs or string literals), timestamps as `integer("col", { mode: "timestamp" })` with `default(sql\`(unixepoch())\`)`
- Snake_case SQL columns, camelCase TypeScript — Drizzle handles mapping
- Booleans: `integer("col", { mode: "boolean" })`, enums: `text("col", { enum: [...] })`
- Updates must manually set `updatedAt: sql\`(unixepoch())\``
- Index naming: `idx_{table}_{col}`, unique: `uniq_{table}_{desc}`
- JSON columns use `check()` constraints: `json_valid(col) OR col IS NULL`

Core tables:
- `accounts` — User profiles (display name, email, bio, avatar)
- `appSettings` — App-level config (activeSpaceId, enableWorktrees, seedVersion)
- `providers` — Agent runtimes; ids come from `src/shared/provider-ids.ts` (`copilot_cli`, `claude_code`, `codex`, `cursor`)
- `projects` — Groups workspaces by shared remote origin (rootPath, workspacesPath, defaultBranch, scripts)
- `projectResources` — Pivot linking projects to `connectionResources` (owned by the `projects` aggregate)
- `workspaces` — Local repos with status tracking (backlog → todo → in_progress → in_review → done → canceled → duplicate)
- `entities` — Unified canonical content (tasks, issues, etc.)
- `tasks` / `issues` — Domain-specific views on entities
- `signals` — Lightweight notification/event records surfaced in the UI
- `connections` / `connectionTokens` / `connectionResources` / `connectionStates` — External service connections, encrypted token blobs, linked resources, integration state
- `spaces` — User-defined UI/prompt configurations; `providerId` (agent engine) and `mode` (developer/work/chat) drive `/code`
- `runs` / `runTurns` / `runContext` / `runArtifacts` — Agent run flow with session resumption via `sessionId` and turn tracking
- `toolCalls` — Tool invocation tracking with nested calls (`parentToolCallId`). There is no `tools` table — the registry is in-code.
- `automations` / `automationRuns` — Scheduled/triggered automation definitions and their execution records
- `pulses` — Aggregated activity-feed records backing the `/pulse` route
- `workspaceActivity` — Workspace activity log (types: diff, review, finding, commit, pr)
- `workspaceDiffs` — Git diffs captured per workspace/run (base ref, diff text, files, stats)
- `reviews` / `reviewFindings` — Workspace-level review notes (open → in_review → approved/rejected) and their findings

### Key Subsystems

**Sync System** (`src/main/modules/sync/`)
- `sync.service.ts` — Orchestrates fetching from all connections
- `connections/` — Provider-specific fetchers (GitHub, GitLab, Linear, Jira, Asana, Trello, Sentry), each with tests
- Produces `EntityInput[]` which gets persisted to the `entities` table

**Workspace System** (`src/main/modules/workspace/`)
- Aggregate module: workspaces + activity + diffs + reviews + findings under one 6-file layout and one `workspace:*` channel namespace
- **Workspace intake**: `workspace:createFromSource` turns a repo into a project + workspace pair. Four acquisitions (`folder`, `clone`, `init`, `worktree`) feed one shared intake tail (git import → `findOrCreateProject` → derive `workspacesPath` → assemble metadata → `createWorkspace`). Never re-inline this at call sites.
- **Workspace git operations**: `workspace:renameBranch`, `workspace:switchBranch`, `workspace:discardPaths`, `workspace:listGitStates` (+ the `workspace:gitStateChanged` watcher event). The current branch is never persisted — it is read live from git.
- **Branch model**: `projects.defaultBranch` = repository integration branch; `workspaces.baseBranch` = that workspace's PR target; the checked-out branch lives only in git.
- Cross-module writers use the named barrel functions `logWorkspaceActivity`, `recordWorkspaceDiff`, `clearWorkspaceDiff`.

**Runs System** (`src/main/modules/runs/`)
- Runs track agent sessions with turns, context, artifacts, and tool calls
- `run-session.ts` / `run-session-registry.ts` own the live session lifecycle and event persistence
- Tool approval broker (`user-input-broker.ts`) bridges main↔renderer for interactive tool approvals
- Runs support session resumption and continuation via `sessionId`

**Projects System** (`src/main/modules/projects/`)
- Groups workspaces by shared git remote origin; owns `project_resources`
- Tracks rootPath, workspacesPath (worktree dir), branches, scripts (setup, run, archive)
- `findByRemoteOrigin`, `findOrCreate`, archive, `listBranchNames`, and the cross-aggregate `projects:listIssues` (project → resources → entities, orchestrated at the service layer)

**Provider Adapters** (`src/main/modules/providers/adapters/`)
- Unified `WorkRunAdapter` interface fronting four agent SDKs; typed events (log, tool_call, command, artifact, status, plan_update)
- `adapter.factory.ts` — creates the correct driver by provider id
- `claude.driver.ts` — Claude Code via `@anthropic-ai/claude-agent-sdk`
- `copilot.driver.ts` — GitHub Copilot CLI via `@github/copilot-sdk`
- `codex.driver.ts` — OpenAI Codex CLI, decomposed into `codex-app-server.client.ts` (process/transport), `codex-session-acquisition.ts` (create/resume/fork/review), `codex-run-coordinator.ts` (live run state, routing, finalization), `codex-capabilities.ts` (models/accounts/skills/plugins), `codex-event-mapper.ts` (notification → event projection), `codex-request-broker.ts` (server-request policy), plus the generated `codex-app-server-protocol/`
- `cursor.driver.ts` — Cursor agent via `@cursor/sdk`
- `fake.driver.ts` — in-memory driver used by tests
- `work-run-core.ts` — shared run loop / event plumbing used by every driver
- `adapter.shared.ts` — common helpers used by every driver
- `mains-mcp-server.ts`, `mains-tools.core.ts`, `mains-tools.schemas.ts`, `mains-tools.registry.ts` — in-process MCP server and the **mains tools** (`GetWorkspaceDiff`, `SaveReview`, `SaveFinding`, `SaveFindings`, `CommitChanges`, `CreatePR`, `CheckPackage`). Handler logic lives once in core, the Zod schema once in schemas, assembly once in the registry with a `providers` allowlist. Never hand-write a tool definition inside a driver.
- Hook system for pre/post tool execution and subagent coordination; pre-approved tool list (Bash, Read, Glob, Grep, …) with interactive approval for others

**Git Module** (`src/main/modules/git/`)
- **Main-process-internal**: no IPC channels, no preload namespace, no renderer caller. Do not re-add a `git:*` namespace.
- Git operations via `simple-git`: status, log, diff, branches, remotes, worktree create/remove, clone/init/import
- Throw-style pilot: methods return plain values and throw
- `captureDiffSnapshot(rootPath, baseRef)` is the single diff-capture operation (unified diff + synthetic untracked hunks + untracked-aware shortstat, all-or-throw). Do not hand-compose diffs elsewhere.
- `git-snapshot.ts` handles snapshot plumbing (including non-ASCII paths)
- Semantics-bearing methods are tested against real temporary git repos, not a mocked `simple-git`

**Git Flow Module** (`src/main/modules/gitFlow/`)
- Deterministic commit / push / PR orchestration for the UI git-actions panel: `getStatus`, `generateCommitMessage`, `generatePrBody`, `commit`, `push`, `createPr`, `publish`, `getPublishPreflight`
- Also the shared building blocks the mains tools (`CommitChanges` / `CreatePR`) delegate to, so git work lives in one place
- Stages with `simple-git`, generates messages via a one-shot headless `adapter.generateText` call, creates PRs with `gh`

**Remote Backend** (`src/main/modules/localBackend/`, `ssh/`, `tailscale/`, `backendAuth/`)
- `localBackend` — turns the running desktop app into a backend other clients can drive (phone browser, LAN device, another mains over SSH), via an in-process WS host on a fixed port over the same handler registry + DB. Two access paths: network bind (token-gated) and Tailscale HTTPS.
- `tailscale` — wraps the `tailscale` CLI (`tailscale serve`) to expose an HTTPS MagicDNS URL; no DB tables
- `ssh` — local `ssh` client forwards a loopback port to a remote `mains serve`, so the renderer connects to `ws://127.0.0.1:<port>` with all traffic tunneled
- `backendAuth` — pairing tokens encrypted at rest via Electron `safeStorage`, stored under userData (never in renderer localStorage)
- Renderer state lives in `backendsSlice`; design notes in `docs/design/remote-backend.md`

**Terminal Module** (`src/main/modules/terminal/`)
- Pseudoterminal emulation via `node-pty`
- IPC channels: `terminal:create`, `terminal:write`, `terminal:resize`, `terminal:destroy`
- Streams output to renderer via `terminal:data` (hand-written handlers — these need the Electron `event.sender`)

**File Explorer Module** (`src/main/modules/fileExplorer/`)
- Secure filesystem operations within workspace boundaries
- Path traversal prevention, symlink escape detection, file size limits (2MB), binary detection

**Space System** (`src/main/modules/space/`)
- User-defined profiles with systemPrompt, model, icon, themeConfig, `providerId`, `mode`, sortOrder, archive flag
- Space-level overrides for connections, resources, apps, and tool permissions
- Active space set via `appSettings.activeSpaceId`

**Tools System** (`src/main/modules/tools/`)
- Registry for local and provider-builtin tools; tool call tracking with nested calls (`parentToolCallId`)

**Guards Module** (`src/main/modules/guards/`)
- Pluggable package-safety adapters (`adapters/socketdev.adapter.ts` behind `adapter.factory.ts`) that score npm/PyPI/etc. packages and scan a workspace's manifests for risky dependencies. No DB tables — results stream back per call.
- Claude/Copilot enforce package safety through a PreToolUse Bash hook; Codex/Cursor expose the `CheckPackage` tool instead. This asymmetry is deliberate.

**Browser Module** (`src/main/modules/browser/`)
- Drives an embedded `WebContentsView` panel inside the Electron window — attach/detach, set bounds, navigate, capture screenshots
- `inspector.script.ts` is injected into the guest page for select-mode (DOM element picking); `browser:navState` streams nav state changes to the renderer

**Automations Module** (`src/main/modules/automations/`)
- User-defined scheduled / triggered automations (cron-style routines that fan out into runs) plus their run records

**Pulse Module** (`src/main/modules/pulse/`)
- Aggregated activity feed across workspaces, runs, and connections — backs the `/pulse` route

**Image Proxy** (`src/main/modules/imageProxy/`)
- Custom protocol handler that fetches and serves remote images to the renderer (avoids CSP / mixed-content issues)
- Pairs with `src/renderer/lib/proxied-image-src.ts` + `local-image-url.ts` and the `useLocalImageUrl` hook — use these instead of `<img src={remoteUrl}>`
- Also backs the `api.documents` namespace (`documents:sign`) for serving local document files

**Stats Module** (`src/main/modules/stats/`) — Dashboard statistics and analytics (joins `workspace_diffs` via its own repo)

**Updates Module** (`src/main/modules/updates/`) — Application update checking and management

**Database Seeding** (`src/main/db/seeds/`)
- Not a domain module and has no IPC surface. A versioned, idempotent runner: each `v{N}.ts` exports `run(db)`, the runner tracks `appSettings.seedVersion`, and `db/client.ts` calls `runSeeds(db)` at init. Fixtures live in `src/main/db/data/` (accounts, connectionStates, providers, spaces).

### Configuration

- `drizzle.config.ts` — Drizzle Kit config (dev database: `.data/mains.db`)
- `drizzle.config.runtime.ts` — Runtime database config (`~/Library/Application Support/mains/mains.db`)
- Migration `.sql` files are copied into the build via Vite plugin and bundled as `extraResource`
- `forge.config.js`, `vite.{main,preload,renderer}.config.mjs`, `entitlements.plist`

### Frontend Conventions

- **Redux**: RTK Query with custom `ipcBaseQuery`, `baseApi.injectEndpoints()` per domain
- **Redux API files** (`src/renderer/lib/redux/api/`): `accountApi`, `appSettingsApi`, `automationsApi`, `connectionsApi`, `entitiesApi`, `gitFlowApi`, `guardsApi`, `projectsApi`, `providersApi`, `pulseApi`, `runsApi`, `shellApi`, `signalsApi`, `spaceApi`, `statsApi`, `syncApi`, `toolsApi`, `updatesApi`, `workspaceApi` — all built on `baseApi.ts`, re-exported via `index.ts`. Aggregate APIs use split RTK Query tag types (e.g. `workspaceApi`: `Workspace`, `WorkspaceActivity`, `WorkspaceDiff`, `WorkspaceReview`, `WorkspaceFinding`) so UI sections refresh independently.
- **Redux slices** (`src/renderer/lib/redux/slices/`): `appSettingsSlice`, `backendsSlice`, `workspaceSlice`
- **Hooks**: `use-kebab-case.ts` filenames, `useCamelCase` export names
- **Components**: `kebab-case.tsx` filenames in feature dirs under `src/renderer/features/{name}/components/`
- **Feature dirs**: `onboarding`, `pulse`, `relay`, `settings`, `stats`, `workspace`
- **Shared input UI**: `src/renderer/components/ui/input/` (`input-form`, `rich-input-form`, `permission-mode-dropdown`, `model-select-dropdown`, `fast-mode-button`, `goal-button`, `dictation-button`, `file-upload-dropdown`, `compact-composer-controls`)
- **Routing**: HashRouter — page components in `src/renderer/routes/`
- **Settings Routing**: `/settings?section={id}` — section ids live in `src/renderer/features/settings/settings-sections.tsx`: `general`, `git`, `connections`, `backends`, `dashboard`, `archive`, `claude`, `codex`, `codex-plugins`, `copilot`, `cursor`, `notifications`, `personalization`, `schedules`, `security`, `projects`
- **Styling**: Tailwind CSS v4 (PostCSS-based)

### Provider Variants (renderer)

The four agent UIs share the single `/code` route and are distinguished by a **provider variant** — `claude | copilot | codex | cursor` (distinct from the DB `ProviderId`: `claude_code`, `copilot_cli`, `codex`, `cursor`). The active variant comes from the active space's `providerId` via `useSpaceProviderVariant`, not from the pathname.

`src/renderer/lib/provider-variants.ts` is the single **variant descriptor** table: each variant's `providerId`, icon/accent classes, and capability facts (`permissionKey`, `permissionDefault`, `effortKey`, `thinkingCoupledToEffort`, `fastMode`, `authLoginCommand`, `supportsUltracode` / `supportsPlanMode` / `supportsGoalMode` / `supportsSkills`, plus `/code` wiring like `planExit`, `enableForkRun`, `enableSuggestions`). Read fields from `getProviderVariant(variant)` — never branch with an inline `variant === "..."` ternary or re-declare the union.

### Icon System

- Icon registry: `src/renderer/lib/icon-registry.tsx` — maps icon names to components in `src/renderer/components/ui/icons/`
- Stored icon values take the form `emoji:<char>`, `icon:<name>`, or `icon:<name>|<color>`. `parseIcon()` returns `{ type: "emoji", value }` or `{ type: "icon", value: Component, color? }`; `formatIcon(mode, value, color)` builds the stored value (the default tint is omitted).
- Colors come from `ICON_COLORS`; `iconColorClass(color)` resolves the text class
- To add an icon: drop the component in `components/ui/icons/` and register it in `iconRegistry`

**App Icon Generation** (macOS)
```bash
# From src/renderer/public/ — regenerate iconset from icon.png (must be 1024x1024+)
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
```

### Input Toolbar (`src/renderer/features/workspace/components/input-toolbar.tsx`)

- Shared toolbar across all four variants (`claude | copilot | codex | cursor`), feature-gated through the variant descriptor rather than inline branching
- **Permission modes**: `default`, `acceptEdits`, `plan`, `bypassPermissions`, `dontAsk`, `auto` — each has a distinct icon and color (`bypassPermissions` uses yellow); rendered by `permission-mode-dropdown.tsx`
- **Effort levels**: `minimal`, `low`, `medium`, `high`, `max`, `xhigh` — display `xhigh` as "Extra High" in UI; per-model availability comes from `modelEffortLevelsByDisplayName`
- **Fast mode**: gradient-styled button (orange→yellow) with animated Bolt icon; boolean for most providers, `serviceTier` for Codex
- **Ultracode**: Claude only — bottom entry of the effort dropdown
- **Thinking mode**: orange-themed toggle with Brain icon plus effort dropdown

### Transcript & Run State (renderer)

- `features/workspace/lib/transcript-rows.ts` — pure (React-free) layout plan for the run transcript. Public: `buildTurnRenderRows(groups)` and `matchTurnsToGroups(...)`; everything else is an internal seam. Keep turn-grouping / accordion / session-bar math out of `workspace-events.tsx`.
- `features/workspace/lib/run-cache.ts` — `createRunCache()` factory owning the retained-run LRU, incremental-sync cursors, loaded/finalized sets, and in-flight dedup behind `use-workspace-runs.ts`. Cursors are monotonic (`Math.max`); `touch(runId)` prunes evicted runs' cursors.
- **Structural plan snapshots** arrive as `plan_update` adapter events and are merged into `run_turns.metadata.codexPlan`, so `TodoSummaryBar` recovers state after reload — not stored as fake tool calls.

### Code Style

- Strict TypeScript, but `any` is allowed (`no-explicit-any: off`)
- Unused vars prefixed with `_` (warn, not error)
- No Prettier — formatting via editor settings + ESLint
- No `import React` needed (`react-jsx` transform)

### Connections (External Services)

Each connection type has:
- Modal in `src/renderer/features/settings/components/connections/`
- Fetcher in `src/main/modules/sync/connections/`
- Channels under `connections:*` for credentials, resources, and states

Supported: GitHub, GitLab, Linear, Jira, Asana, Trello, Sentry (+ Socket.dev for the guards module).

**Credential Storage (Encrypted JSON Blob)**

All provider secrets are stored as a single encrypted JSON blob in `connectionTokens.accessTokenEnc`. Each provider declares its secret fields in `PROVIDER_SECRET_FIELDS` (`connections.utils.ts`), shaped as `{ required: string[]; optional?: string[] }`:

| Provider  | Secret fields | Non-secret metadata |
|-----------|--------------|---------------------|
| GitHub    | `token` | — |
| Linear    | `apiKey` | — |
| Jira      | `apiToken` | `domain`, `email` |
| GitLab    | `token` | `domain` |
| Asana     | `accessToken` | — |
| Trello    | `token`, `apiKey` | — |
| Sentry    | `token` | — |
| Socket.dev | `apiToken` | — |

Key functions (in `connections.utils.ts` unless noted):
- `encryptSecrets(secrets)` / `decryptSecrets(buffer)` — encrypt/decrypt the JSON blob
- `parseProviderCredentials(provider, credentials)` — validates and extracts secrets per provider config
- `createTokenHash`, `parseConnectionMetadata` — module-internal helpers, not re-exported
- `getConnectionWithSecrets(provider)` (in `connections.service.ts`, exported from the barrel) — returns `{ id, secrets, metadata }` for sync fetchers and guards
- `getConnectionAndSecrets(connectionId)` — same pattern for connection operations

To add a new provider's secrets: add an entry to `PROVIDER_SECRET_FIELDS`. Non-secret fields (domain, email) go in `PROVIDER_METADATA_FIELDS` in `connections.service.ts`. Never import the crypto helpers across modules — call `getConnectionWithSecrets`.

### Troubleshooting

- **Preload changes not taking effect**: Restart the dev server completely; changes to `src/preload/index.ts` require a full restart
- **Database locked errors**: Close all app instances, then `npm run db:clean:dev && npm run db:push`
- **Dual DB paths**: `.data/mains.db` (dev) vs `~/Library/Application Support/mains/mains.db` (packaged)
- **`vitest` fails on better-sqlite3**: run `npm rebuild better-sqlite3` (the `npm test` scripts do this for you)
