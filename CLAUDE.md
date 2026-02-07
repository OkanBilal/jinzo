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
npm run db:seed         # Seed apps and connections
npm run db:clean:dev    # Reset dev database
npm run db:clean:runtime  # Reset runtime database (~/Library/Application Support/jinzo/)

# Linting
npm run lint            # Run ESLint on src/
npm run lint:fix        # Run ESLint with auto-fix

# Build & Package
npm run package         # Package app for current platform
npm run make            # Create distributable
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
- Namespaced by domain: `api.chat`, `api.entities`, `api.feed`, `api.sync`, etc.
- After modifying preload, restart dev server to pick up changes

**Renderer** (`src/renderer/`)
- React app with Redux Toolkit, React Router (HashRouter), `@/` alias → `src/renderer/`
- Routes: `/` (Home), `/chat/:id` (Chat), `/copilot/:workspaceId` (Copilot), `/claude/:workspaceId` (Claude Agent), `/journal` (Journal), `/settings` (Settings)

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
4. **State Management**: RTK Query for server state, Redux slices for UI state (`chatSlice`, `moodSlice`, `appSettingsSlice`)

### Database Schema (`src/main/db/schema.ts`)

Conventions:
- Text primary keys (UUIDs or string literals), timestamps as `integer("col", { mode: "timestamp" })` with `default(sql\`(unixepoch())\`)`
- Snake_case SQL columns, camelCase TypeScript — Drizzle handles mapping
- Booleans: `integer("col", { mode: "boolean" })`, enums: `text("col", { enum: [...] })`
- Updates must manually set `updatedAt: sql\`(unixepoch())\``
- Index naming: `idx_{table}_{col}`, unique: `uniq_{table}_{desc}`

Core tables:
- `providers` - LLM/agent runtimes (ollama, copilot_cli, claude_code)
- `entities` - Unified canonical content (tasks, issues, bookmarks, articles, podcasts, videos, etc.)
- `entityChunks` / `vecEntityChunks` - Chunked content with embeddings for vector search
- `connections` / `connectionResources` - External service connections (GitHub, Raindrop, RSS, etc.)
- `feedItems` - Event log/timeline entries
- `chatSessions` / `chatMessages` - Chat history with provider/model tracking
- `moods` - User-defined UI/prompt configurations
- `runs` / `runContext` / `runArtifacts` / `runCommands` - Terminal/code-writing flow (agent runs)
- `tools` / `toolCalls` / `moodToolPermissions` - Tool registry and invocation tracking

Domain-specific views on entities:
- `tasks` - Actionable tasks (status, priority, due date)
- `issues` - GitHub/Linear issues
- `playlistItems` - Ordered collections

### Key Subsystems

**Sync System** (`src/main/modules/sync/`)
- `sync.service.ts` - Orchestrates fetching from all connections
- `connections/` - Provider-specific fetchers (GitHub, Raindrop, RSS, Spotify, Apple Music, Podcasts, YouTube, Notion)
- Produces `EntityInput[]` which gets persisted to `entities` table

**RAG Pipeline** (`src/renderer/lib/rag/`)
- `embed.ts` - Embedding generation (Ollama)
- `retrieval.ts` - Vector + keyword search with reranking
- `chunking.ts` - Text chunking strategies
- `prompt-optimizer.ts` - Builds context-aware prompts

**MCP Tools** (`src/main/modules/mcp/`)
- Model Context Protocol integration for tool use
- Tools in `tools/`: entity-tools, sync-tools, mood-tools, journal-tools
- Server/client pattern for Ollama tool calling

**Chat System** (`src/main/modules/chat/`)
- Supports multiple modes: direct chat, RAG-augmented, MCP tool-enabled
- Tracks provider/model per session and per message

**Workspace/Runs System** (`src/main/modules/workspaces/`, `src/main/modules/runs/`)
- Workspaces link to local git repositories via `rootPath`
- Runs track terminal/agent sessions with commands and artifacts
- WorkspaceResources link entities (issues, etc.) to workspaces

### Configuration

- `drizzle.config.ts` - Drizzle Kit config (dev database: `.data/jinzo.db`)
- Runtime database: `~/Library/Application Support/jinzo/jinzo.db`
- `src/renderer/lib/config/` - Chunking, embedding, retrieval, cache settings
- Migration `.sql` files are copied into the build via Vite plugin and bundled as `extraResource`

### Frontend Conventions

- **Redux**: RTK Query with custom `ipcBaseQuery`, `baseApi.injectEndpoints()` per domain
- **Hooks**: `use-kebab-case.ts` filenames, `useCamelCase` export names
- **Components**: `kebab-case.tsx` filenames in feature dirs under `src/renderer/features/{name}/components/`
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

Supported: GitHub, Linear, Raindrop, HackerNews, RSS, Spotify, Apple Music, Podcasts, YouTube, Notion

### Troubleshooting

- **Preload changes not taking effect**: Restart the dev server completely; changes to `src/preload/index.ts` require a full restart
- **Database locked errors**: Close all app instances, then `npm run db:clean:dev && npm run db:push`
- **Ollama connection issues**: Ensure Ollama is running with `ollama serve`
- **Dual DB paths**: `.data/jinzo.db` (dev) vs `~/Library/Application Support/jinzo/jinzo.db` (packaged)
