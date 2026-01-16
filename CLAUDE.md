# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jinzo is an Electron-based desktop application that integrates AI chat capabilities with a personal knowledge feed system. It uses Ollama for local LLM inference, SQLite for data persistence with vector search capabilities, and supports multiple external service integrations (GitHub, Raindrop, RSS, Notion, etc.).

## Development Commands

### Starting the Application
```bash
npm start                    # Launch the Electron app in development mode
```

### Building and Packaging
```bash
npm run package             # Package the app for distribution
npm run make                # Create distributable installers
npm run publish             # Publish the app
```

### Database Management
```bash
npm run db:generate         # Generate Drizzle schema migrations
npm run db:push             # Push schema changes to database
npm run db:studio           # Open Drizzle Studio GUI for database inspection
npm run db:seed             # Seed all data (apps, connections, feed items)
npm run db:seed:apps        # Seed app states only
npm run db:seed:connections # Seed connections only
npm run db:seed:feed        # Seed feed items only
```

### Linting
```bash
npm run lint                # Currently not configured
```

## Architecture

### Electron Process Architecture

The application follows standard Electron architecture with three distinct processes:

**Main Process** (`src/main/`): Node.js environment handling system operations, database access, and IPC communication. Entry point is `src/main/index.ts`.

**Preload Script** (`src/preload/index.ts`): Security boundary that exposes a type-safe IPC API to the renderer through `contextBridge`. All main-to-renderer communication must go through this API.

**Renderer Process** (`src/renderer/`): React application running in a Chromium browser context with HashRouter for navigation.

### Database Layer

The application uses a singleton `DatabaseClient` pattern (`src/main/db/client.ts`) that:
- Initializes a SQLite database with WAL mode enabled for better concurrency
- Loads the `sqlite-vec` extension for vector search capabilities
- Runs migrations from `src/main/db/migrations/` on startup
- Stores data in the Electron userData directory as `jinzo.db`
- The drizzle.config.ts points to `.data/jinzo.db` for CLI operations (development only)

Schema is defined in `src/main/db/schema.ts` and includes:
- **feedItems**: User's aggregated content from various sources
- **chatSessions/chatMessages**: Chat history
- **vec_feed_items/vec_feed_item_map**: Vector embeddings for semantic search
- **feedItemChunks/vec_chunks/vec_chunk_map**: Chunked content with embeddings for RAG
- **connections/connectionTokens/connectionSyncState**: OAuth connections and sync state
- **connectionResources**: User-selected resources (repos, collections, etc.)
- **appStates**: UI state for integrated apps
- **accounts**: User profile information

### IPC Communication Pattern

All communication between renderer and main processes uses IPC handlers registered in `src/main/ipc/*Handlers.ts` files. Each handler module exports:
- `register*Handlers()`: Registers ipcMain handlers
- `unregister*Handlers()`: Cleans up handlers (called on app quit)

The preload script exposes a type-safe API object with namespaced methods (database, account, apps, chat, cron, feed, mcp, ollama, connectionCredentials, connections) that invoke these handlers.

### State Management

Redux Toolkit with RTK Query for API state management:
- Store configured in `src/renderer/lib/redux/index.ts`
- API endpoints split by domain in `src/renderer/lib/redux/api/*Api.ts`
- Chat state persisted to localStorage via redux-persist
- Base API in `src/renderer/lib/redux/api/baseApi.ts` uses IPC as the transport layer

### Chat System

The chat system integrates with Ollama for LLM inference:
- Chat handler in `src/main/ipc/chatHandlers.ts` manages streaming responses
- Streams data to renderer via IPC events: `chat:stream-chunk`, `chat:stream-final`, `chat:stream-error`
- Chat configuration stored in database, retrieved via `chat:getConfig`
- Message validation and processing in `src/renderer/lib/chat/`

### RAG (Retrieval-Augmented Generation)

Vector embeddings are generated using Ollama's embedding models:
- Embedding generation in `src/renderer/lib/rag/embed.ts` with caching
- Content is chunked in `src/renderer/lib/rag/chunking.ts` before embedding
- Retrieval logic in `src/renderer/lib/rag/retrieval.ts` uses sqlite-vec for similarity search
- Feed items and chunks are stored separately with mapping tables for vector lookups

### MCP (Model Context Protocol)

Custom implementation for providing tools to the LLM:
- Client in `src/renderer/lib/mcp/client.ts` manages tool definitions
- Feed tools in `src/renderer/lib/mcp/tools/feed-tools.ts` allow LLM to query user's feed
- Tools are Ollama-compatible function definitions
- Execution happens in renderer process, accessed via IPC

### Cron/Sync System

Background synchronization for external services:
- Entry point in `src/renderer/lib/cron/index.ts`
- Per-provider implementations in `src/renderer/lib/cron/connections/*.ts`
- Each provider implements fetching, processing, and storing feed items
- Sync state tracked in `connection_sync_state` table with cursors and backoff
- Manual sync triggered via `cron:runFeedSync` IPC call

### Routing

React Router with hash-based routing:
- `/` - Home page with weather widget and quick prompts
- `/feed` - Aggregated feed from all sources
- `/chat/:id` - Chat interface with specific session

## Key Technical Details

### TypeScript Configuration
Three separate tsconfig files for different build targets:
- `tsconfig.main.json`: Main process (Node.js environment)
- `tsconfig.preload.json`: Preload script (hybrid environment)
- `tsconfig.renderer.json`: Renderer process (DOM environment)

### Vite Build Configuration
Three separate Vite configs:
- `vite.main.config.mjs`: Builds main process
- `vite.preload.config.mjs`: Builds preload script
- `vite.renderer.config.mjs`: Builds renderer with React

### Native Dependencies
The app uses native modules (better-sqlite3, sqlite-vec) that require rebuilding for Electron:
- `@electron/rebuild` configured in devDependencies
- Automatic rebuild handled by `@electron-forge/plugin-auto-unpack-natives`

### Security Model
- Preload script uses `contextBridge` to expose limited, type-safe API
- No nodeIntegration in renderer process
- Tokens encrypted as blobs in `connection_tokens.accessTokenEnc`
- Fuses configured in forge.config.js for additional security hardening

## Important Patterns

### Database Queries
Always use the Drizzle ORM through the singleton client. Never write raw SQL unless necessary for vector operations. Database queries should be in `src/main/db/queries/` or in IPC handlers.

### Adding New IPC Handlers
1. Create handler file in `src/main/ipc/`
2. Export `register*Handlers()` and optionally `unregister*Handlers()`
3. Call register function in `src/main/index.ts`
4. Add type-safe method to preload API in `src/preload/index.ts`
5. Use from renderer via `window.api.*`

### Vector Search Queries
Vector searches use sqlite-vec extension. Embeddings must be stored as BLOBs using the `floatArrayToBuffer()` helper. Vector tables (`vec_feed_items`, `vec_chunks`) are separate with mapping tables to maintain referential integrity.

### Connection Management
Connections follow a provider-based pattern:
1. Connection created in `connections` table with OAuth metadata
2. Tokens stored encrypted in `connection_tokens`
3. User-selected resources stored in `connection_resources`
4. Sync state tracked in `connection_sync_state`
5. App state updated in `app_states` to reflect connection status
