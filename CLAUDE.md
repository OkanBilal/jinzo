# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
npm start

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

# Maintenance
npm run clean           # Remove build artifacts (.vite, dist, out, caches)
npm run reset           # Rebuild better-sqlite3 + reset dev database
npm run hard-reset      # Full reset (reset + nuke node_modules + reinstall)
```

Tests require `better-sqlite3` to be rebuilt against the local Node ABI — the `test*` scripts handle this automatically, but running `vitest` directly will fail if you skip that step (use `npm rebuild better-sqlite3` first). Tests live next to the file under test as `*.test.ts`; vitest config is `vitest.config.mts`.

## Architecture Overview

Mains is an Electron 41 desktop app (React 19 renderer, SQLite + Drizzle ORM). CommonJS package with ESM Vite configs (`.mjs`). **macOS only** (Apple Silicon and Intel) — Windows and Linux are not supported.

### Process Boundaries

**Main Process** (`src/main/`)
- Entry point: `src/main/index.ts` - initializes database, registers IPC handlers, creates window
- Database client: `src/main/db/client.ts` - singleton with better-sqlite3, Drizzle ORM
- Modules: `src/main/modules/` - domain modules with layered architecture

**Preload** (`src/preload/index.ts`)
- Exposes `window.api` object with typed IPC methods
- Namespaced by domain: `api.entities`, `api.tasks`, `api.issues`, `api.signals`, `api.account`, `api.connectionStates`, `api.sync`, `api.connectionCredentials`, `api.connections`, `api.guards`, `api.projects`, `api.projectResources`, `api.seed`, `api.space`, `api.appSettings`, `api.providers`, `api.skillsMarketplace`, `api.toolCalls`, `api.workspaces`, `api.runs`, `api.reviews`, `api.reviewFindings`, `api.workspaceDiffs`, `api.workspaceActivity`, `api.runContext`, `api.runArtifacts`, `api.runTurns`, `api.fileExplorer`, `api.git`, `api.terminal`, `api.platform`, `api.imageProxy`, `api.shell`, `api.stats`, `api.app`, `api.updates`, `api.browser`, `api.automations`, `api.pulse`
- After modifying preload, restart dev server to pick up changes

**Renderer** (`src/renderer/`)
- React app with Redux Toolkit, React Router (HashRouter), `@/` alias → `src/renderer/`
- Routes: `/` (default route), `/settings`, `/copilot[/:workspaceId]` (GitHub Copilot agent), `/claude[/:workspaceId]` (Claude Code agent), `/codex[/:workspaceId]` (OpenAI Codex agent), `/cursor[/:workspaceId]` (Cursor agent), `/plugins`, `/pulse`, `/relay`
- Copilot / Claude / Codex / Cursor routes share the same workspace UI but pick different provider IDs (`copilot_cli`, `claude_code`, `codex`, `cursor`)
- Route table lives in `src/renderer/components/layout/main/main-routes.tsx`

### Module Architecture (`src/main/modules/`)

Each domain module follows a layered pattern (see `src/main/modules/account/` as reference):

| File | Role |
|------|------|
| `{name}.ipc.ts` | `registerXxxIpc()` / `unregisterXxxIpc()` using `ipcMain.handle` — calls `xxxService` directly |
| `{name}.service.ts` | Object literal with business logic, uses `this` for sibling calls. Returns `Promise<ServiceResponse<T>>` constructed via `ok()` / `fail()` from `src/shared/ipc-kit/service-response`. |
| `{name}.repo.ts` | Object literal, calls `getDb()` per method, Drizzle queries |
| `{name}.dto.ts` | Types via `typeof table.$inferSelect`, formatter functions, re-exports `ServiceResponse` from `src/shared/ipc-kit/service-response` |
| `{name}.validation.ts` | Hand-rolled allowlist validation (no zod/yup) |
| `index.ts` | Barrel exports |

**Critical**: All layers are **plain object literals**, never classes. No DI — repos call `getDb()` inline.

**No controller layer.** Earlier versions had a `{name}.controller.ts` between `ipc.ts` and `service.ts`. It was a pure pass-through — `ipc.ts` now calls `service` directly. Argument unpacking (e.g. `{ projectId, resourceId }` → two args) lives at the `ipc.ts` call site.

All modules: `account`, `appSettings`, `automations`, `browser`, `connectionStates`, `connectionCredentials`, `connections`, `entities`, `fileExplorer`, `git`, `guards`, `imageProxy`, `projects`, `providers`, `pulse`, `reviewFindings`, `reviews`, `runs`, `seed`, `skillsMarketplace`, `space`, `stats`, `sync`, `terminal`, `tools`, `updates`, `workspaceActivity`, `workspaceDiffs`, `workspaceResources`, `workspaces`

A handful of modules deviate from the canonical 6-file layout — `guards`, `browser`, `skillsMarketplace`, and `terminal` skip the repo/dto layer because they don't own database tables (they wrap external sources, native handles, or HTTP). When adding a module, match a sibling with similar responsibilities rather than blindly copying `account/`.

### IPC Convention

Channel format: `"domain:action"` (e.g. `"entities:getAll"`). All channels are defined once in `src/shared/ipc-kit/channels.ts` as a typed map (`CHANNELS.entities.getAll`). Main, preload, and renderer all import and reference values from that map — never type the channel string literally. Adding a channel = one edit; renaming = one edit; typo = compile-time error.

Sites that reference the registry:

1. `src/preload/index.ts` — `ipcRenderer.invoke(CHANNELS.entities.getAll, ...)`
2. `src/main/modules/{name}/{name}.ipc.ts` — `ipcMain.handle(CHANNELS.entities.getAll, ...)`
3. `src/renderer/lib/redux/api/{name}Api.ts` — `{ handler: CHANNELS.entities.getAll }`

All IPC responses use `ServiceResponse<T>` envelope: `ok(data)` or `fail(message)` from `src/shared/ipc-kit/service-response`.

### Data Flow

1. **IPC Communication**: Renderer calls `window.api.namespace.method()` → Preload invokes IPC → Main handles
2. **Module Flow**: IPC handler → Service → Repository → Database
3. **Redux Integration**: `src/renderer/lib/redux/api/baseApi.ts` wraps IPC in RTK Query with custom `ipcBaseQuery` (no HTTP)
4. **State Management**: RTK Query for server state, Redux slices for UI state (`spaceSlice`, `appSettingsSlice`, `workspaceSlice`)

### Database Schema (`src/main/db/schema.ts`)

Conventions:
- Text primary keys (UUIDs or string literals), timestamps as `integer("col", { mode: "timestamp" })` with `default(sql\`(unixepoch())\`)`
- Snake_case SQL columns, camelCase TypeScript — Drizzle handles mapping
- Booleans: `integer("col", { mode: "boolean" })`, enums: `text("col", { enum: [...] })`
- Updates must manually set `updatedAt: sql\`(unixepoch())\``
- Index naming: `idx_{table}_{col}`, unique: `uniq_{table}_{desc}`
- JSON columns use `check()` constraints: `json_valid(col) OR col IS NULL`

Core tables:
- `accounts` - User profiles (display name, email, bio, avatar)
- `appSettings` - App-level config (activeSpaceId, enableWorktrees)
- `providers` - Agent runtimes (copilot_cli, claude_code)
- `projects` - Groups workspaces by shared remote origin (rootPath, branches, scripts)
- `workspaces` - Local repos with status tracking (backlog → todo → in_progress → in_review → done → canceled → duplicate)
- `workspaceResources` - Pivot table linking workspaces to connectionResources
- `entities` - Unified canonical content (tasks, issues, etc.)
- `connections` / `connectionResources` / `connectionTokens` / `connectionSyncState` - External service connections, encrypted tokens, sync cursors
- `connectionStates` - Connection integration states (GitHub, GitLab, Linear, Jira, Asana, Trello, Notion — tracks isConnected, features, config)
- `spaces` - User-defined UI/prompt configurations with theme/UI config JSON
- `runs` / `runContext` / `runArtifacts` / `runTurns` - Terminal/code-writing flow (agent runs with session resumption via sessionId, turn tracking)
- `tools` / `toolCalls` - Tool registry (local, provider_builtin) and invocation tracking with nested tool call support (parentToolCallId)
- `workspaceActivity` - Workspace activity log (types: diff, review, finding, commit, pr — with title, summary, metadata JSON, refId)
- `workspaceDiffs` - Git diffs captured per workspace/run (base ref, diff text, files, stats)
- `reviews` - Workspace-level review notes (status: open, in_review, approved, rejected)
- `reviewFindings` - Individual code review findings linked to reviews
- `projectResources` - Pivot table linking projects to connectionResources

Domain-specific views on entities:
- `tasks` - Actionable tasks (status, priority, due date)
- `issues` - GitHub/Linear/Jira/Asana/Trello issues

### Key Subsystems

**Sync System** (`src/main/modules/sync/`)
- `sync.service.ts` - Orchestrates fetching from all connections
- `connections/` - Provider-specific fetchers (GitHub, GitLab, Linear, Jira, Asana, Trello, Notion)
- Produces `EntityInput[]` which gets persisted to `entities` table

**Workspace/Runs System** (`src/main/modules/workspaces/`, `src/main/modules/runs/`)
- Workspaces link to local git repositories via `rootPath`, belong to projects via `projectId`
- Workspace status tracking: backlog → todo → in_progress → in_review → done → canceled → duplicate
- Runs track terminal/agent sessions with commands and artifacts
- WorkspaceResources link entities (issues, etc.) to workspaces
- Run execution uses provider adapters (see below) with event streaming
- Tool approval broker (`user-input-broker.ts`) bridges main↔renderer for interactive tool approvals
- Runs support session resumption and continuation via `sessionId`

**Projects System** (`src/main/modules/projects/`)
- Groups workspaces by shared git remote origin
- Tracks rootPath, workspacesPath (worktree dir), branches, scripts (setup, run, archive)
- findByRemoteOrigin, findOrCreate, archive support

**Provider Adapters** (`src/main/modules/providers/adapters/`)
- Unified `WorkRunAdapter` interface for different agent runtimes
- `adapter.factory.ts` — Factory creates the correct adapter by provider type
- `claude.adapter.ts` — Claude Code CLI via `@anthropic-ai/claude-agent-sdk`
- `copilot.adapter.ts` — GitHub Copilot CLI via `@github/copilot-sdk`
- `codex.adapter.ts` — OpenAI Codex CLI
- `cursor.adapter.ts` — Cursor agent via `@cursor/sdk`
- `adapter.shared.ts` — common helpers used by every adapter (covered by `adapter.shared.test.ts`)
- `mains-mcp-server.ts` / `mains-tools.core.ts` — in-process MCP server and tool definitions exposed to agents
- Event-driven architecture with typed events (log, tool_call, command, artifact, status)
- Hook system for pre/post tool execution, subagent/teammate coordination
- Pre-approved tool list (Bash, Read, Glob, Grep, etc.) with interactive approval for others

**Git Module** (`src/main/modules/git/`)
- Git operations via `simple-git`: status, log, diff, branches, remotes
- Worktree management: create/remove worktrees for isolated branch work
- Local repo import with worktree creation

**Terminal Module** (`src/main/modules/terminal/`)
- Pseudoterminal emulation via `node-pty`
- IPC channels: `terminal:create`, `terminal:write`, `terminal:resize`, `terminal:destroy`
- Streams output to renderer via `terminal:data` event

**File Explorer Module** (`src/main/modules/fileExplorer/`)
- Secure filesystem operations within workspace boundaries
- Path traversal prevention, symlink escape detection, file size limits (2MB), binary detection

**Workspace Activity** (`src/main/modules/workspaceActivity/`)
- Activity log per workspace (types: diff, review, finding, commit, pr)
- Fire-and-forget `log()` method for non-blocking activity recording
- Supports batch creation via `createMany`

**Workspace Diffs** (`src/main/modules/workspaceDiffs/`)
- Captures git HEAD sha at run start, computes diffs after run completion
- Stores diff text, file lists, and stats linked to runs and workspaces

**Reviews** (`src/main/modules/reviews/`, `src/main/modules/reviewFindings/`)
- Workspace-level review/notes system with status tracking (open → in_review → approved/rejected)
- Individual code review findings linked to reviews with severity, file, line range, and suggestions

**Space System** (`src/main/modules/space/`)
- User-defined profiles with systemPrompt, model, icon, themeConfig, uiConfig
- Space-level overrides for connections, resources, apps, and tool permissions
- Active space set via appSettings

**Tools System** (`src/main/modules/tools/`)
- Registry for local and provider-builtin tools
- Tool call tracking with nested call support (parentToolCallId)

**Seed Module** (`src/main/modules/seed/`)
- Database seeding for initial setup (connectionStates, connections, providers, spaces, accounts)

**Image Proxy** (`src/main/modules/imageProxy/`)
- Custom protocol handler that fetches and serves remote images to the renderer (avoids CSP / mixed-content issues)
- Pairs with `src/renderer/lib/proxied-image-src.ts` + `local-image-url.ts` and the `useLocalImageUrl` hook — use these when rendering remote URLs in the renderer rather than `<img src={remoteUrl}>` directly

**Guards Module** (`src/main/modules/guards/`)
- Pluggable package-safety adapters (`adapters/`) that score npm/PyPI/etc. packages and scan a workspace's manifests for risky dependencies. No DB tables — results stream back to the renderer per call.

**Browser Module** (`src/main/modules/browser/`)
- Drives an embedded `BrowserView`/`WebContentsView` panel inside the Electron window — attach/detach, set bounds, navigate, capture screenshots
- `inspector.script.ts` is injected into the guest page for select-mode (DOM element picking); IPC `browser:navState` streams nav state changes to the renderer

**Automations Module** (`src/main/modules/automations/`)
- User-defined scheduled / triggered automations (cron-style routines that fan out into runs)

**Pulse Module** (`src/main/modules/pulse/`)
- Aggregated activity feed across workspaces, runs, and connections — backs the `/pulse` route

**Skills Marketplace** (`src/main/modules/skillsMarketplace/`)
- Browse / search / inspect external agent skill bundles (list, search, curated, detail, audit). No local table — proxies a remote registry.

**Stats Module** (`src/main/modules/stats/`)
- Dashboard statistics and analytics

**Updates Module** (`src/main/modules/updates/`)
- Application update checking and management

### Configuration

- `drizzle.config.ts` - Drizzle Kit config (dev database: `.data/mains.db`)
- `drizzle.config.runtime.ts` - Runtime database config (`~/Library/Application Support/mains/mains.db`)
- Migration `.sql` files are copied into the build via Vite plugin and bundled as `extraResource`

### Frontend Conventions

- **Redux**: RTK Query with custom `ipcBaseQuery`, `baseApi.injectEndpoints()` per domain
- **Redux API files** (`src/renderer/lib/redux/api/`): `accountApi`, `appSettingsApi`, `automationsApi`, `connectionsApi`, `connectionStates`, `entitiesApi`, `guardsApi`, `projectsApi`, `providersApi`, `pulseApi`, `reviewFindingsApi`, `reviewsApi`, `runsApi`, `shellApi`, `signalsApi`, `skillsMarketplaceApi`, `spaceApi`, `statsApi`, `syncApi`, `toolsApi`, `updatesApi`, `workspaceActivityApi`, `workspaceDiffsApi`, `workspaceResourcesApi`, `workspacesApi`
- **Redux slices**: `appSettingsSlice`, `workspaceSlice` (in `src/renderer/lib/redux/slices/`)
- **Hooks**: `use-kebab-case.ts` filenames, `useCamelCase` export names
- **Components**: `kebab-case.tsx` filenames in feature dirs under `src/renderer/features/{name}/components/`
- **Feature dirs**: `onboarding`, `pulse`, `settings`, `stats`, `workspace`
- **Routing**: HashRouter — routes defined in `src/renderer/routes/`
- **Settings Routing**: `/settings?section={sectionName}` — query parameter controls active tab (general, connections, claude, copilot, codex, codex-plugins, projects, git, dashboard, etc.)
- **Styling**: Tailwind CSS v4 (PostCSS-based)

### Icon System

**Space Icons** (`src/renderer/components/ui/icons/space/`)
- Icon registry: `src/renderer/lib/icon-registry.tsx` — maps icon names to components
- `parseIcon()` returns typed icons: `emoji`, `icon`, `copilot-animate`, `claude-animate`, `codex-animate`
- Animated icon types get special hover behavior in `space-selector.tsx`:
  - `copilot-animate` — sprite-based frame animation via `data-animation-state`
  - `claude-animate` — geometric arm animation (individual `<line>` elements with `scaleX` CSS animations)
  - `codex-animate` — spin animation via `animate-spin-slow` CSS class
- SVG icons support custom props: `Bolt` has `animated?: boolean` (flame effects + gradient fill), `Claude` has `animate?: boolean` (arm retract/extend)
- To add a new animated space icon: add a type to `parseIcon()` return union, handle in both `icon:` prefix and bare name lookups, add rendering case in `space-selector.tsx`

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

- Shared toolbar across claude/copilot/codex variants, feature-gated by `variant` prop
- **Permission modes**: `default`, `acceptEdits`, `plan`, `bypassPermissions`, `dontAsk` — each has distinct icon and color (bypassPermissions uses yellow)
- **Effort levels**: `minimal`, `low`, `medium`, `high`, `max`, `xhigh` — display `xhigh` as "Extra High" in UI
- **Fast mode**: Gradient-styled button (orange→yellow) with animated Bolt icon (SVG gradient fill + flame elements)
- **Thinking mode**: Orange-themed toggle with Brain icon, effort level dropdown

### Code Style

- Strict TypeScript, but `any` is allowed (`no-explicit-any: off`)
- Unused vars prefixed with `_` (warn, not error)
- No Prettier — formatting via editor settings + ESLint
- No `import React` needed (`react-jsx` transform)

### Connections (External Services)

Each connection type has:
- Modal in `src/renderer/features/settings/components/connections/`
- Fetcher in `src/main/modules/sync/connections/`
- IPC handlers for credentials and resource management

Supported: GitHub, GitLab, Linear, Jira, Asana, Trello, Notion

**Credential Storage (Encrypted JSON Blob)**

All provider secrets are stored as a single encrypted JSON blob in `connectionTokens.accessTokenEnc`. Each provider defines its secret fields in `PROVIDER_SECRET_FIELDS` (`connectionCredentials.utils.ts`):

| Provider | Secret fields | Non-secret metadata |
|----------|--------------|---------------------|
| GitHub   | `{ token }` | — |
| Linear   | `{ apiKey }` | — |
| Jira     | `{ apiToken }` | `domain`, `email` |
| GitLab   | `{ token }` | `domain` |
| Asana    | `{ accessToken }` | — |
| Trello   | `{ token, apiKey }` | — |

Key functions:
- `encryptSecrets(secrets)` / `decryptSecrets(buffer)` — encrypt/decrypt the JSON blob
- `parseProviderCredentials(provider, credentials)` — validates and extracts secrets per provider config
- `getConnectionWithSecrets(provider)` — returns `{ id, secrets: Record<string, string>, metadata }` for sync fetchers
- `getConnectionAndSecrets(connectionId)` — same pattern for `connections.service.ts`

To add a new provider's secrets: add an entry to `PROVIDER_SECRET_FIELDS`. Non-secret fields (domain, email) go in `PROVIDER_METADATA_FIELDS` in `connectionCredentials.service.ts`.

### Troubleshooting

- **Preload changes not taking effect**: Restart the dev server completely; changes to `src/preload/index.ts` require a full restart
- **Database locked errors**: Close all app instances, then `npm run db:clean:dev && npm run db:push`
- **Dual DB paths**: `.data/mains.db` (dev) vs `~/Library/Application Support/mains/mains.db` (packaged)
