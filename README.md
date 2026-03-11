<div align="center">

# Jinzo

**AI-powered developer workspace**

Run GitHub Copilot and Claude Code agents in managed workspaces, track runs with full observability, and sync issues from GitHub, Linear, Jira, Asana, and Notion — all from a single desktop app.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-40-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Drizzle_ORM-003B57.svg?logo=sqlite&logoColor=white)](https://orm.drizzle.team/)

</div>

## Features

- **AI Agents** — Run GitHub Copilot and Claude Code in managed workspaces with session resumption, tool approval, and run tracking (commands, artifacts, turns, usage)
- **Workspaces & Projects** — Git-backed workspaces with status tracking (backlog → done), worktree support, diffs per run, and code reviews with findings
- **Integrations** — Sync issues and tasks from GitHub, GitLab, Linear, Jira, Asana, Trello, and Notion
- **Spaces** — Custom profiles with system prompts, models, themes, and UI configuration per agent
- **Developer Tools** — Built-in terminal, file explorer, and git operations

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org/) 18+, Git

```bash
git clone https://github.com/OkanBilal/jinzo.git
cd jinzo
npm install
npm run db:push
npm start
```

Then:
1. Configure a provider (Copilot or Claude) in **Settings**
2. Link integrations (GitHub, Linear, etc.) and sync issues
3. Create a workspace from a local repo
4. Open the Copilot or Claude view and run an agent

## Development

```bash
npm start                  # Start dev server
npm test                   # Run tests
npm run test:coverage      # Coverage report
npm run lint:fix           # Lint with auto-fix
npm run package            # Package for current platform
npm run make               # Create distributable
```

### Database

```bash
npm run db:push            # Push schema to dev database
npm run db:studio          # Open Drizzle Studio
npm run db:generate        # Generate migration from schema changes
npm run db:clean:dev       # Reset dev database
```

## Architecture

Jinzo is an Electron 40 app with a React 19 renderer and SQLite + Drizzle ORM on the main process.

```
src/
├── main/                  # Electron main process
│   ├── db/                # Database client, schema, migrations
│   ├── modules/           # Domain modules (layered architecture)
│   │   ├── account/       # User accounts
│   │   ├── connections/   # External service connections
│   │   ├── entities/      # Unified content (tasks, issues)
│   │   ├── git/           # Git operations and worktrees
│   │   ├── projects/      # Project grouping by remote origin
│   │   ├── providers/     # Agent adapters (Copilot, Claude)
│   │   ├── runs/          # Agent run tracking
│   │   ├── sync/          # Integration sync engine
│   │   ├── workspaces/    # Workspace management
│   │   └── ...            # 25+ modules total
│   └── runtime/           # Run dispatcher and writeback
├── preload/               # IPC bridge (window.api)
└── renderer/              # React app
    ├── features/          # Feature modules (workspace, settings, stats)
    ├── lib/redux/         # Redux store, RTK Query APIs
    └── routes/            # Route components
```

Each domain module follows: **IPC → Controller → Service → Repository → DTO**. All layers are plain object literals — no classes, no DI.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 40 |
| Frontend | React 19, Redux Toolkit, React Router |
| Database | SQLite (better-sqlite3), Drizzle ORM |
| AI Providers | GitHub Copilot SDK, Claude Agent SDK |
| Styling | Tailwind CSS v4 |
| Build | Vite, Electron Forge, TypeScript |
| Testing | Vitest, v8 coverage |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Database locked | Close all instances, then `npm run db:clean:dev && npm run db:push` |
| Preload changes not working | Full restart required for `src/preload/index.ts` changes |
| Build errors after pull | `rm -rf node_modules package-lock.json && npm install` |
| better-sqlite3 mismatch | `npm rebuild better-sqlite3` |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, code style, and development workflow.

## Security

To report vulnerabilities, see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) &copy; [Okan Bilal Balcı](https://github.com/OkanBilal)
