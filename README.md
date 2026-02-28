# Jinzo

<div align="center">

**A powerful AI-powered personal assistant for knowledge management**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-40.0.0-blue.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Architecture](#architecture)
- [Database](#database)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

Jinzo is an AI-powered personal assistant that helps you organize, search, and interact with your digital content from multiple sources. It features:

- **RAG-Augmented Chat**: Context-aware conversations using retrieval-augmented generation
- **Vector Search**: SQLite-based vector database with semantic search capabilities
- **Multi-Provider Support**: Compatible with Ollama, GitHub Copilot, and Claude
- **External Integrations**: Sync content from GitHub, Raindrop, RSS feeds, Spotify, Apple Music, YouTube, Notion, and more
- **MCP Tools**: Model Context Protocol integration for advanced tool use
- **Personal Knowledge Base**: Unified storage for tasks, issues, bookmarks, articles, podcasts, videos, and notes

## Screenshots

> 🚧 *Screenshots coming soon*

## Features

### 🤖 AI Chat
- Multiple chat modes: direct chat, RAG-augmented, and MCP tool-enabled
- Conversation history with provider/model tracking
- Custom spaces (UI/prompt configurations)
- Rich markdown support with code highlighting

### 📚 Content Aggregation
- Pull content from multiple services into a unified entity system
- Automatic chunking and embedding for semantic search
- Timeline-based feed for tracking updates
- Support for tasks, issues, bookmarks, articles, podcasts, videos, and more

### 🔌 Integrations
- **GitHub**: Issues, PRs, repositories
- **Raindrop**: Bookmarks and collections
- **RSS/HackerNews**: News feeds and articles
- **Spotify/Apple Music**: Playlists and tracks
- **Podcasts**: Episodes and shows
- **YouTube**: Videos and playlists
- **Notion**: Pages and databases

## Tech Stack

- **Framework**: Electron 40.0.0
- **Frontend**: React 19, Redux Toolkit, React Router
- **Database**: SQLite with better-sqlite3, Drizzle ORM
- **Vector Search**: sqlite-vec extension
- **AI/ML**: Ollama, GitHub Copilot SDK, MCP SDK
- **Styling**: Tailwind CSS v4
- **Build**: Vite, TypeScript

## Architecture

Jinzo follows a clean architecture pattern with clear separation between processes:

```
jinzo/
├── src/
│   ├── main/          # Electron main process
│   │   ├── db/        # Database client and schema
│   │   └── modules/   # Domain modules (layered architecture)
│   ├── preload/       # IPC bridge (window.api)
│   └── renderer/      # React app (UI)
```

### Module Structure

Each domain module follows a consistent layered pattern:
- **IPC Layer**: Handler registration/unregistration
- **Controller**: Request handling and validation
- **Service**: Business logic
- **Repository**: Database queries
- **DTO**: Type definitions and response formatters

## Installation

### Prerequisites

Before installing Jinzo, ensure you have the following:

- **Node.js** 18 or higher ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Ollama** (for local LLM support) - [Installation Guide](https://ollama.ai/)
  - After installing Ollama, pull a model: `ollama pull llama3`
- **Git** (for cloning the repository)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/jinzo.git
cd jinzo

# Install dependencies
npm install

# Set up development database
npm run db:push

# Seed initial data
npm run db:seed
```

## Usage

### Quick Start

1. **Start the application**:
   ```bash
   npm start
   ```

2. **Configure Ollama** (first-time setup):
   - Ensure Ollama is running: `ollama serve`
   - The app will automatically detect available models

3. **Add Connections** (optional):
   - Navigate to Settings → Connections
   - Connect your GitHub, Raindrop, Notion, or other services
   - Sync content with the "Sync" button

4. **Start Chatting**:
   - Click "New Chat" to create a conversation
   - Choose a space/configuration
   - Enable RAG mode to search your synced content

### Key Concepts

- **Entities**: Unified storage for all your content (tasks, bookmarks, articles, etc.)
- **Spaces**: Pre-configured chat personalities and system prompts
- **RAG Mode**: Enable context-aware responses using your personal knowledge base
- **MCP Tools**: Allow the AI to perform actions (search entities, manage tasks, etc.)

## Development

### Start Development Server

```bash
npm start
```

### Database Operations

```bash
# Generate migrations from schema changes
npm run db:generate

# Push schema to development database
npm run db:push

# Open Drizzle Studio (dev database)
npm run db:studio

# Open Drizzle Studio (runtime database)
npm run db:studio:runtime

# Seed apps and connections
npm run db:seed

# Reset development database
npm run db:clean:dev

# Reset runtime database
npm run db:clean:runtime

# Reset all databases
npm run db:clean:all
```

### Linting

```bash
# Run ESLint
npm run lint

# Run ESLint with auto-fix
npm run lint:fix
```

### Build & Package

```bash
# Package app for current platform
npm run package

# Create distributable
npm run make
```

## Database

### Development Database
Located at `.data/jinzo.db` (gitignored)

### Runtime Database
Located at `~/Library/Application Support/jinzo/jinzo.db`

### Core Tables
- `providers` - LLM/agent runtimes
- `entities` - Unified canonical content
- `entityChunks` / `vecEntityChunks` - Chunked content with embeddings
- `connections` / `connectionResources` - External service connections
- `feedItems` - Event log/timeline entries
- `chatSessions` / `chatMessages` - Chat history
- `spaces` - User-defined UI/prompt configurations
- `tools` / `toolCalls` - Tool registry and invocation tracking

## Configuration

- **Drizzle Config**: `drizzle.config.ts` (dev), `drizzle.config.runtime.ts` (runtime)
- **RAG Settings**: `src/renderer/lib/config/` (chunking, embedding, retrieval)
- **Vite Config**: `vite.main.config.mjs`, `vite.preload.config.mjs`, `vite.renderer.config.mjs`

## Project Structure

```
jinzo/
├── assets/                      # Application assets
├── docs/                        # Documentation
├── src/
│   ├── main/
│   │   ├── db/                  # Database client, schema, queries
│   │   ├── modules/             # Domain modules
│   │   │   ├── account/         # User account management
│   │   │   ├── chat/            # Chat sessions and messages
│   │   │   ├── connections/     # External service connections
│   │   │   ├── entities/        # Content entities
│   │   │   ├── feed/            # Timeline feed
│   │   │   ├── mcp/             # Model Context Protocol tools
│   │   │   ├── spaces/           # UI/prompt configurations
│   │   │   ├── providers/       # LLM providers
│   │   │   ├── sync/            # Content synchronization
│   │   │   └── ...
│   │   └── index.ts             # Main process entry point
│   ├── preload/
│   │   └── index.ts             # IPC bridge (exposes window.api)
│   └── renderer/
│       ├── components/          # Shared UI components
│       ├── features/            # Feature modules
│       ├── hooks/               # Global custom hooks
│       ├── lib/                 # Utilities and libraries
│       │   ├── rag/             # RAG pipeline (embed, retrieval, chunking)
│       │   └── redux/           # Redux store and slices
│       ├── routes/              # Route components
│       └── index.tsx            # Renderer entry point
├── .data/                       # Development database (gitignored)
├── drizzle.config.ts            # Drizzle Kit config (dev)
├── drizzle.config.runtime.ts    # Drizzle Kit config (runtime)
└── package.json
```

## Troubleshooting

### Common Issues

**Ollama connection issues**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama service
ollama serve
```

**Database locked errors**
```bash
# Close all instances of the app
# Reset the development database
npm run db:clean:dev
npm run db:push
```

**Build errors after pulling updates**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

**Preload changes not taking effect**
- Restart the development server completely (Ctrl+C, then `npm start`)
- Changes to `src/preload/index.ts` require a full restart

### Getting Help

- Check the [CLAUDE.md](./CLAUDE.md) file for detailed development guidance
- Open an issue on GitHub with:
  - Your OS version
  - Node.js version (`node --version`)
  - Steps to reproduce the problem
  - Error messages or logs

## Contributing

Contributions, issues, and feature requests are welcome! This is a personal project, but community input is appreciated.

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and architecture patterns
- Run `npm run lint:fix` before committing
- Update documentation for significant changes
- See [CLAUDE.md](./CLAUDE.md) for detailed development guidance

## License

MIT © Okan Bilal Balcı

## Contact

- **Author**: Okan Bilal Balcı
- **Email**: obbalci@gmail.com
- **Project Link**: [https://github.com/yourusername/jinzo](https://github.com/yourusername/jinzo)

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Powered by [Ollama](https://ollama.ai/) for local LLM inference
- Vector search via [sqlite-vec](https://github.com/asg017/sqlite-vec)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)

---

⭐ If you find Jinzo useful, consider starring the repository!

For detailed development guidance, see [CLAUDE.md](./CLAUDE.md).
