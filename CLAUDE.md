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
npm run db:clean:runtime  # Reset runtime database (~/Library/Application Support/jinzo/)
npm run db:clean:all    # Reset both databases

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

## Architecture Overview

Jinzo is an Electron 40 desktop app (React 19 renderer, SQLite + Drizzle ORM, sqlite-vec for vector search). CommonJS package with ESM Vite configs (`.mjs`).

### Process Boundaries

**Main Process** (`src/main/`)
- Entry point: `src/main/index.ts` - initializes database, registers IPC handlers, creates window
- Database client: `src/main/db/client.ts` - singleton with better-sqlite3, Drizzle ORM, sqlite-vec extension
- Modules: `src/main/modules/` - domain modules with layered architecture

**Preload** (`src/preload/index.ts`)
- Exposes `window.api` object with typed IPC methods
- Namespaced by domain: `api.entities`, `api.tasks`, `api.issues`, `api.account`, `api.apps`, `api.chat`, `api.sync`, `api.feed`, `api.mcp`, `api.ollama`, `api.connectionCredentials`, `api.connections`, `api.projects`, `api.projectResources`, `api.seed`, `api.space`, `api.appSettings`, `api.journal`, `api.providers`, `api.tools`, `api.toolCalls`, `api.workspaces`, `api.runs`, `api.reviews`, `api.reviewFindings`, `api.workspaceDiffs`, `api.workspaceActivity`, `api.runContext`, `api.runArtifacts`, `api.runTurns`, `api.fileExplorer`, `api.git`, `api.terminal`, `api.platform`, `api.shell`, `api.feedback`, `api.stats`, `api.app`, `api.updates`
- After modifying preload, restart dev server to pick up changes

**Renderer** (`src/renderer/`)
- React app with Redux Toolkit, React Router (HashRouter), `@/` alias → `src/renderer/`
- Routes: `/` (Home with defaultRoute redirect), `/settings` (Settings), `/copilot` and `/copilot/:workspaceId` (Copilot — GitHub Copilot agent), `/claude` and `/claude/:workspaceId` (Claude Code agent)
- Chat (`/chat/:id`) and Journal (`/journal`) routes exist but are currently commented out
- Copilot and Claude routes share the same workspace UI but use different provider IDs (`copilot_cli` vs `claude_code`)

### Module Architecture (`src/main/modules/`)

Each domain module follows a layered pattern (see `src/main/modules/account/` as reference):

| File | Role |
|------|------|
| `{name}.ipc.ts` | `registerXxxIpc()` / `unregisterXxxIpc()` using `ipcMain.handle` |
| `{name}.controller.ts` | Object literal, returns `Promise<ServiceResponse<T>>` |
| `{name}.service.ts` | Object literal with business logic, uses `this` for sibling calls |
| `{name}.repo.ts` | Object literal, calls `getDb()` per method, Drizzle queries |
| `{name}.dto.ts` | Types via `typeof table.$inferSelect`, formatter functions |
| `{name}.validation.ts` | Hand-rolled allowlist validation (no zod/yup) |
| `index.ts` | Barrel exports |

**Critical**: All layers are **plain object literals**, never classes. No DI — repos call `getDb()` inline.

All modules: `account`, `appSettings`, `apps`, `chat`, `connectionCredentials`, `connections`, `entities`, `feed`, `feedback`, `fileExplorer`, `git`, `imageProxy`, `journal`, `mcp`, `space`, `ollama`, `projects`, `providers`, `reviewFindings`, `reviews`, `runs`, `seed`, `stats`, `sync`, `terminal`, `tools`, `updates`, `workspaceActivity`, `workspaceDiffs`, `workspaceResources`, `workspaces`

### IPC Convention

Channel format: `"domain:action"` (e.g. `"chat:send"`, `"entities:getAll"`). Channels must stay in sync across three files — there is no shared registry:

1. `src/preload/index.ts` — `ipcRenderer.invoke("domain:action")`
2. `src/main/modules/{name}/{name}.ipc.ts` — `ipcMain.handle("domain:action")`
3. `src/renderer/lib/redux/api/{name}Api.ts` — `{ handler: "domain:action" }`

All IPC responses use `ServiceResponse<T>` envelope: `{ success: true, data }` or `{ success: false, error }`.

### Data Flow

1. **IPC Communication**: Renderer calls `window.api.namespace.method()` → Preload invokes IPC → Main handles
2. **Module Flow**: IPC handler → Controller → Service → Repository → Database
3. **Redux Integration**: `src/renderer/lib/redux/api/baseApi.ts` wraps IPC in RTK Query with custom `ipcBaseQuery` (no HTTP)
4. **State Management**: RTK Query for server state, Redux slices for UI state (`chatSlice`, `spaceSlice`, `appSettingsSlice`, `workspaceSlice`, `journalEditingSlice`)

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
- `providers` - LLM/agent runtimes (ollama, copilot_cli, claude_code)
- `projects` - Groups workspaces by shared remote origin (rootPath, branches, scripts)
- `workspaces` - Local repos with status tracking (backlog → todo → in_progress → in_review → done → canceled → duplicate)
- `workspaceResources` - Pivot table linking workspaces to connectionResources
- `entities` - Unified canonical content (tasks, issues, bookmarks, articles, podcasts, videos, etc.)
- `entityChunks` / `vecEntityChunks` / `vecEntityChunkMap` - Chunked content with embeddings for vector search
- `connections` / `connectionResources` / `connectionTokens` / `connectionSyncState` - External service connections, encrypted tokens, sync cursors
- `appStates` - App integration states (GitHub, Notion, Raindrop, etc. — tracks isConnected, features, config)
- `spaces` - User-defined UI/prompt configurations with theme/UI config JSON
- `feedItems` - Event log/timeline entries
- `chatSessions` / `chatMessages` - Chat history with provider/model tracking, observability (traceId, latencyMs, token counts)
- `runs` / `runContext` / `runArtifacts` / `runTurns` / `runUsage` - Terminal/code-writing flow (agent runs with session resumption via sessionId, turn tracking, and usage metrics)
- `tools` / `toolCalls` - Tool registry (local, mcp, provider_builtin) and invocation tracking with nested tool call support (parentToolCallId)
- `workspaceActivity` - Workspace activity log (types: diff, review, finding, commit, pr — with title, summary, metadata JSON, refId)
- `workspaceDiffs` - Git diffs captured per workspace/run (base ref, diff text, files, stats)
- `reviews` - Workspace-level review notes (status: open, in_review, approved, rejected)
- `reviewFindings` - Individual code review findings linked to reviews
- `projectResources` - Pivot table linking projects to connectionResources
- `documentRevisions` - Journal revision history (title, body, wordCount per entity)
- `outbox` - Offline-first action queue for retryable external operations

Domain-specific views on entities:
- `tasks` - Actionable tasks (status, priority, due date)
- `issues` - GitHub/Linear/Jira/Asana issues

### Key Subsystems

**Sync System** (`src/main/modules/sync/`)
- `sync.service.ts` - Orchestrates fetching from all connections
- `connections/` - Provider-specific fetchers (GitHub, GitLab, Raindrop, RSS, Spotify, Apple Music, Podcasts, YouTube, Notion, Linear, Jira, Asana, HackerNews)
- Produces `EntityInput[]` which gets persisted to `entities` table

**RAG Pipeline** (`src/renderer/lib/rag/`)
- `embed.ts` - Embedding generation (Ollama)
- `retrieval.ts` - Vector + keyword search with reranking
- `chunking.ts` - Text chunking strategies
- `prompt-optimizer.ts` - Builds context-aware prompts

**MCP Tools** (`src/main/modules/mcp/`)
- Model Context Protocol integration for tool use
- Tools in `tools/`: entity-tools, sync-tools, space-tools, journal-tools
- Server/client pattern for Ollama tool calling

**Chat System** (`src/main/modules/chat/`)
- Supports multiple modes: direct chat, RAG-augmented, MCP tool-enabled
- Tracks provider/model per session and per message
- Per-message observability: traceId, latencyMs, inputTokens, outputTokens

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

**Journal System** (`src/main/modules/journal/`)
- Full document management with drafts, publishing, and revision history
- Documents stored as entities (kind: doc/journal), revisions in `documentRevisions` table
- Live update support via IPC events

**Space System** (`src/main/modules/space/`)
- User-defined profiles with systemPrompt, model, icon, themeConfig, uiConfig
- Space-level overrides for connections, resources, apps, and tool permissions
- Active space set via appSettings

**Tools System** (`src/main/modules/tools/`)
- Registry for local, MCP, and provider-builtin tools
- Tool call tracking with nested call support (parentToolCallId)

**Seed Module** (`src/main/modules/seed/`)
- Database seeding for initial setup (apps, connections, providers, spaces, accounts)

**Image Proxy** (`src/main/modules/imageProxy/`)
- Protocol handler for enhanced image loading in the renderer

**Ollama Integration** (`src/main/modules/ollama/`)
- Local LLM model management and info

**Feedback Module** (`src/main/modules/feedback/`)
- User feedback collection and management

**Stats Module** (`src/main/modules/stats/`)
- Dashboard statistics and analytics

**Updates Module** (`src/main/modules/updates/`)
- Application update checking and management

### Configuration

- `drizzle.config.ts` - Drizzle Kit config (dev database: `.data/jinzo.db`)
- `drizzle.config.runtime.ts` - Runtime database config (`~/Library/Application Support/jinzo/jinzo.db`)
- `src/renderer/lib/config/` - Chunking, embedding, retrieval, cache settings
- Migration `.sql` files are copied into the build via Vite plugin and bundled as `extraResource`

### Frontend Conventions

- **Redux**: RTK Query with custom `ipcBaseQuery`, `baseApi.injectEndpoints()` per domain
- **Redux API files**: `accountApi`, `appsApi`, `appSettingsApi`, `chatApi`, `connectionsApi`, `entitiesApi`, `feedApi`, `journalApi`, `mcpApi`, `spaceApi`, `ollamaApi`, `projectsApi`, `providersApi`, `reviewsApi`, `reviewFindingsApi`, `runsApi`, `shellApi`, `statsApi`, `syncApi`, `toolsApi`, `updatesApi`, `workspaceActivityApi`, `workspaceDiffsApi`, `workspaceResourcesApi`, `workspacesApi`
- **Redux slices**: `chatSlice`, `spaceSlice`, `appSettingsSlice`, `workspaceSlice`, `journalEditingSlice`
- **Hooks**: `use-kebab-case.ts` filenames, `useCamelCase` export names
- **Components**: `kebab-case.tsx` filenames in feature dirs under `src/renderer/features/{name}/components/`
- **Feature dirs**: `chat`, `journal`, `onboarding`, `settings`, `stats`, `workspace`
- **Routing**: HashRouter — routes defined in `src/renderer/routes/`
- **Styling**: Tailwind CSS v4 (PostCSS-based)

### Code Style

- Strict TypeScript, but `any` is allowed (`no-explicit-any: off`)
- Unused vars prefixed with `_` (warn, not error)
- No Prettier — formatting via editor settings + ESLint
- No `import React` needed (`react-jsx` transform)

### Connections (External Services)

Each connection type has:
- Modal in `src/renderer/features/settings/components/apps/`
- Fetcher in `src/main/modules/sync/connections/`
- IPC handlers for credentials and resource management

Supported: GitHub, GitLab, Linear, Jira, Asana, Raindrop, HackerNews, RSS, Spotify, Apple Music, Podcasts, YouTube, Notion

### Troubleshooting

- **Preload changes not taking effect**: Restart the dev server completely; changes to `src/preload/index.ts` require a full restart
- **Database locked errors**: Close all app instances, then `npm run db:clean:dev && npm run db:push`
- **Ollama connection issues**: Ensure Ollama is running with `ollama serve`
- **Dual DB paths**: `.data/jinzo.db` (dev) vs `~/Library/Application Support/jinzo/jinzo.db` (packaged)
