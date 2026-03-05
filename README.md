# Jinzo

<div align="center">

**AI-powered developer workspace**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-40-blue.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

</div>

---

## Overview

Jinzo is a desktop app that brings together AI agents, code workspaces, and content from external services into a single interface. It supports multiple AI providers (Ollama, GitHub Copilot, Claude Code), tracks agent runs with full observability, and provides RAG-augmented chat over a personal knowledge base synced from GitHub, Linear, Jira, Notion, and more.

## Features

### AI Agents & Chat
- Run GitHub Copilot and Claude Code agents in managed workspaces
- Direct chat, RAG-augmented, and MCP tool-enabled modes
- Agent run tracking with commands, artifacts, turns, and usage metrics
- Session resumption and continuation
- Interactive tool approval with pre-approved tool lists
- Custom spaces with system prompts, themes, and UI configuration

### Workspaces & Projects
- Git-backed workspaces with status tracking (backlog → done)
- Projects group workspaces by shared git remote origin
- Worktree support for isolated branch work
- Workspace diffs captured per run (base ref, file stats)
- Code reviews with findings (severity, file, line range, suggestions)

### Content Aggregation
- Unified entity system for tasks, issues, bookmarks, articles, podcasts, videos, notes
- Automatic chunking and embedding for semantic search (sqlite-vec)
- Timeline feed for tracking updates
- Offline-first action queue for retryable external operations

### Journal
- Full document management with drafts, publishing, and revision history
- Rich text editing with word count tracking

### Integrations
- **GitHub** / **GitLab**: Issues, PRs, repositories
- **Linear** / **Jira** / **Asana**: Issue tracking
- **Raindrop**: Bookmarks and collections
- **Notion**: Pages and databases
- **RSS** / **HackerNews**: News feeds and articles
- **Spotify** / **Apple Music**: Playlists and tracks
- **Podcasts**: Episodes and shows
- **YouTube**: Videos and playlists

### Developer Tools
- Built-in terminal (node-pty)
- File explorer with path traversal prevention
- Git operations (status, log, diff, branches, remotes, worktrees)
- MCP server registry (stdio, http, ws transports)

## Tech Stack

- **Framework**: Electron 40
- **Frontend**: React 19, Redux Toolkit, React Router
- **Database**: SQLite (better-sqlite3), Drizzle ORM, sqlite-vec
- **AI Providers**: Ollama, GitHub Copilot SDK, Claude Agent SDK
- **Styling**: Tailwind CSS v4
- **Build**: Vite, Electron Forge, TypeScript

## Installation

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Ollama** (optional, for local LLM support) — [ollama.ai](https://ollama.ai/)
- **Git**

### Setup

```bash
git clone https://github.com/laurelresearch/jinzo.git
cd jinzo
npm install
npm run db:push
```

## Usage

```bash
# Start the app
npm start
```

1. **Configure a provider**: Connect Ollama, GitHub Copilot, or Claude Code in Settings
2. **Add connections** (optional): Link GitHub, Linear, Notion, etc. and sync content
3. **Create a workspace**: Import a local repo or create from a project
4. **Run an agent**: Open the Copilot or Claude view to run agents against your workspace
5. **Chat**: Use direct chat or enable RAG mode to query your synced content

## Development

```bash
npm start                  # Start dev server
npm run lint               # Run ESLint
npm run lint:fix           # ESLint with auto-fix
npm run package            # Package for current platform
npm run make               # Create distributable
```

### Database

```bash
npm run db:generate        # Generate migrations from schema changes
npm run db:push            # Push schema to dev database
npm run db:studio          # Drizzle Studio (dev: .data/jinzo.db)
npm run db:studio:runtime  # Drizzle Studio (runtime: ~/Library/Application Support/jinzo/jinzo.db)
npm run db:clean:dev       # Reset dev database
npm run db:clean:runtime   # Reset runtime database
npm run db:clean:all       # Reset both databases
```

## Architecture

```
src/
├── main/                  # Electron main process
│   ├── db/                # Database client, schema, migrations
│   └── modules/           # Domain modules (layered architecture)
│       ├── account/       # User accounts
│       ├── chat/          # Chat sessions and messages
│       ├── connections/   # External service connections
│       ├── entities/      # Unified content entities
│       ├── feed/          # Timeline feed
│       ├── fileExplorer/  # Secure filesystem operations
│       ├── git/           # Git operations and worktrees
│       ├── journal/       # Document management
│       ├── mcp/           # Model Context Protocol tools
│       ├── projects/      # Project grouping
│       ├── providers/     # LLM provider adapters
│       ├── reviews/       # Code review management
│       ├── runs/          # Agent run tracking
│       ├── space/         # UI/prompt configurations
│       ├── sync/          # Content synchronization
│       ├── terminal/      # Pseudoterminal (node-pty)
│       ├── tools/         # Tool registry and permissions
│       ├── workspaces/    # Workspace management
│       └── ...
├── preload/               # IPC bridge (window.api)
└── renderer/              # React app
    ├── components/        # Shared UI components
    ├── features/          # Feature modules (chat, workspace, journal, settings, ...)
    ├── hooks/             # Custom hooks
    ├── lib/
    │   ├── rag/           # RAG pipeline (embed, retrieval, chunking)
    │   └── redux/         # Redux store, slices, RTK Query APIs
    └── routes/            # Route components
```

Each domain module follows a consistent layered pattern: IPC → Controller → Service → Repository → DTO. All layers are plain object literals (no classes, no DI).

## Troubleshooting

**Ollama connection issues**: Ensure Ollama is running with `ollama serve`

**Database locked errors**: Close all app instances, then `npm run db:clean:dev && npm run db:push`

**Preload changes not taking effect**: Restart the dev server completely — changes to `src/preload/index.ts` require a full restart

**Build errors after pulling updates**: `rm -rf node_modules package-lock.json && npm install`

See [CLAUDE.md](./CLAUDE.md) for detailed development guidance.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run `npm run lint:fix` before committing
4. Open a Pull Request

## License

MIT © Okan Bilal Balcı

## Contact

- **Author**: Okan Bilal Balcı
- **Email**: obbalci@gmail.com
- **Project**: [github.com/laurelresearch/jinzo](https://github.com/laurelresearch/jinzo)
