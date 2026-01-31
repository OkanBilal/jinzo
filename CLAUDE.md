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

Jinzo is an Electron desktop app built with React, using a local SQLite database with vector search capabilities for RAG-powered chat.

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
- React app with Redux Toolkit, React Router (HashRouter)
- Routes: `/` (Home), `/chat/:id` (Chat), `/workspace/:workspaceId` (Workspace), `/claude/:workspaceId` (Claude Agent), `/journal` (Journal), `/settings` (Settings)

### Module Architecture (`src/main/modules/`)

Each domain module follows a layered pattern:
```
module/
├── index.ts           # Public exports
├── {module}.ipc.ts    # IPC handler registration (registerXxxIpc/unregisterXxxIpc)
├── {module}.controller.ts  # Request handling, validation dispatch
├── {module}.service.ts     # Business logic
├── {module}.repo.ts        # Database queries (Drizzle)
├── {module}.dto.ts         # Type definitions, response formatters
├── {module}.validation.ts  # Input validation
└── {module}.constants.ts   # Module constants
```

Example: `src/main/modules/account/` handles user account CRUD with this exact structure.

### Data Flow

1. **IPC Communication**: Renderer calls `window.api.namespace.method()` → Preload invokes IPC → Main handles
2. **Module Flow**: IPC handler → Controller → Service → Repository → Database
3. **Redux Integration**: `src/renderer/lib/redux/api/baseApi.ts` wraps IPC in RTK Query
4. **State Management**: RTK Query for server state, Redux slices for UI state (`chatSlice`, `moodSlice`, `appSettingsSlice`)

### Database Schema (`src/main/db/schema.ts`)

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

### UI Structure

- `src/renderer/components/` - Shared UI components and layout (sidebar, config panel)
- `src/renderer/features/` - Feature modules (chat, home, settings)
- `src/renderer/hooks/` - Global custom hooks (useActiveMood, useTheme, useClickOutside)
- `src/renderer/routes/` - Route components (Chat.tsx, Home.tsx)
- Styling: Tailwind CSS v4

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
