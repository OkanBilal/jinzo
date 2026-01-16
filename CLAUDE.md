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
- IPC handlers: `src/main/ipc/` - each file exports `registerXxxHandlers()` functions

**Preload** (`src/preload/index.ts`)
- Exposes `window.api` object with typed IPC methods
- Namespaced by domain: `api.chat`, `api.entities`, `api.feed`, `api.sync`, etc.

**Renderer** (`src/renderer/`)
- React app with Redux Toolkit, React Router (HashRouter)
- Routes: `/` (Home), `/chat/:id` (Chat)

### Data Flow

1. **IPC Communication**: Renderer calls `window.api.namespace.method()` → Preload invokes IPC → Main handles
2. **Redux Integration**: `src/renderer/lib/redux/api/baseApi.ts` wraps IPC in RTK Query
3. **State Management**: RTK Query for server state, Redux slices for UI state (`chatSlice`, `moodSlice`, `appSettingsSlice`)

### Database Schema (`src/main/db/schema.ts`)

Core tables:
- `entities` - Unified canonical content (tasks, issues, bookmarks, articles, podcasts, videos, etc.)
- `entityChunks` / `vecEntityChunks` - Chunked content with embeddings for vector search
- `connections` / `connectionResources` - External service connections (GitHub, Raindrop, RSS, etc.)
- `feedItems` - Event log/timeline entries
- `chatSessions` / `chatMessages` - Chat history
- `moods` - User-defined UI/prompt configurations

Domain-specific views on entities:
- `tasks` - Actionable tasks (status, priority, due date)
- `issues` - GitHub/Linear issues
- `playlistItems` - Ordered collections

### Key Subsystems

**Sync System** (`src/renderer/lib/sync/`)
- `fetchers.ts` - Orchestrates fetching from all connections
- `connections/` - Provider-specific fetchers (GitHub, Raindrop, HackerNews, RSS, Spotify, Apple Music, Podcasts)
- Produces `EntityInput[]` which gets persisted to `entities` table

**RAG Pipeline** (`src/renderer/lib/rag/`)
- `embed.ts` - Embedding generation (Ollama)
- `retrieval.ts` - Vector + keyword search with reranking
- `chunking.ts` - Text chunking strategies
- `prompt-optimizer.ts` - Builds context-aware prompts

**MCP Tools** (`src/renderer/lib/mcp/`)
- Model Context Protocol integration for tool use
- Tools: entity list/search, sync trigger, mood switching
- Server/client pattern for Ollama tool calling

**Chat Modes** (`src/main/ipc/chatHandlers.ts`)
- `chat` - Direct LLM conversation
- `rag` - Query analysis → entity retrieval → augmented prompt
- `mcp` - Tool-enabled conversation with entity/sync/mood tools

### Configuration

- `drizzle.config.ts` - Drizzle Kit config (dev database: `.data/jinzo.db`)
- Runtime database: `~/Library/Application Support/jinzo/jinzo.db`
- `src/renderer/lib/config/` - Chunking, embedding, retrieval, cache settings

### UI Structure

- `src/renderer/components/layout/` - Sidebar, config panel
- `src/renderer/features/` - Feature modules (chat, home, settings)
- `src/renderer/hooks/` - Custom hooks (useActiveMood, useTheme)
- Styling: Tailwind CSS v4

### Connections (External Services)

Each connection type has:
- Modal in `src/renderer/features/settings/components/apps/`
- Fetcher in `src/renderer/lib/sync/connections/`
- IPC handlers for credentials and resource management

Supported: GitHub, Raindrop, HackerNews, RSS, Spotify, Apple Music, Podcasts
