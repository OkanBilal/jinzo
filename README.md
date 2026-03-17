<div align="center">
  <br />
  <a href="https://github.com/OkanBilal/jinzo">
    <img src="src/renderer/public/icon.png" width="100" alt="Jinzo" />
  </a>
  <br />
  <br />
  <p>
    <h3>
      <b>Jinzo</b>
    </h3>
  </p>
  <p>
    <b>
      AI-powered developer workspace
    </b>
  </p>
  <p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-40-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Drizzle_ORM-003B57.svg?logo=sqlite&logoColor=white)](https://orm.drizzle.team/)

  </p>
</div>

---

Jinzo - _Japanese for "artificial" (人造)_ - is a desktop app for running AI coding agents in managed workspaces. It wraps **GitHub Copilot** and **Claude Code** SDKs, tracks every run with full observability, and syncs issues from the tools you already use — all from one place.

```
npm install
npm start
```

## Features

- **Multi-Agent** - Run GitHub Copilot and Claude Code side by side with session resumption, tool approval, and usage tracking
- **Workspaces** - Git-backed workspaces with status tracking (backlog → done), worktree isolation, diffs per run, and code reviews
- **Integrations** - Sync issues from GitHub, GitLab, Linear, Jira, Asana, and Trello
- **Spaces** - Custom profiles with system prompts, model selection, themes, and per-agent UI configuration
- **Structured Output** - Define JSON schemas to constrain agent output format via Claude SDK's `outputFormat`
- **MCP Support** - Connect external tools via Model Context Protocol; auto-loads `.mcp.json` from project root
- **Built-in Tools** - Terminal emulator, file explorer, git operations, and workspace activity log

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org/) 18+, Git

```bash
git clone https://github.com/OkanBilal/jinzo.git
cd jinzo
npm install
npm start
```

1. Open **Settings** and configure a provider (Copilot or Claude)
2. Add a local git repository as a workspace
3. Open the Copilot or Claude view and start an agent run

For Copilot, you'll need [GitHub CLI](https://cli.github.com/) authenticated (`gh auth login`).

## Architecture

Electron 40 app — React 19 renderer, SQLite + Drizzle ORM on the main process.

```
src/
├── main/              # Main process
│   ├── db/            # Schema, migrations, client
│   └── modules/       # 25+ domain modules
│       ├── providers/ # Agent adapters (Copilot, Claude)
│       ├── runs/      # Run tracking & tool approval
│       ├── sync/      # Integration sync engine
│       └── ...
├── preload/           # IPC bridge (window.api)
└── renderer/          # React app
    ├── features/      # Feature modules
    ├── lib/redux/     # RTK Query + slices
    └── routes/
```

Each module follows **IPC → Controller → Service → Repository**. All layers are plain object literals.

### Stack

| | |
|---|---|
| **Runtime** | Electron 40, Node.js |
| **Frontend** | React 19, Redux Toolkit, React Router, Tailwind CSS v4 |
| **Database** | SQLite (better-sqlite3), Drizzle ORM |
| **AI** | GitHub Copilot SDK, Claude Agent SDK |
| **Build** | Vite, Electron Forge, TypeScript |

## Development

```bash
npm start              # Dev server
npm run lint:fix       # Lint with auto-fix
npm run package        # Package for current platform
npm run make           # Create distributable
```

### Database

```bash
npm run db:push        # Push schema changes
npm run db:studio      # Open Drizzle Studio
npm run db:generate    # Generate migrations
npm run db:clean:dev   # Reset dev database
```

### Troubleshooting

- **Database locked** — Close all instances, run `npm run db:clean:dev && npm run db:push`
- **Preload changes not working** — Full restart required for `src/preload/index.ts` changes
- **better-sqlite3 mismatch** — Run `npm run reset`
- **Full reset** — Run `npm run hard-reset`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) &copy; [Okan Bilal Balci](https://github.com/OkanBilal)
