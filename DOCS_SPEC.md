# Jinzo Documentation Spec

> This file is the single source of truth for building the Fumadocs documentation site.
> Feed this file to Claude Code along with the instruction: "Implement a Fumadocs documentation site based on DOCS_SPEC.md"

---

## 1. Project Identity

- **Name:** Jinzo
- **Tagline:** A unified desktop workspace for AI agents, knowledge, and code.
- **Author:** Okan Bilal Balci
- **License:** MIT
- **Platform:** macOS desktop (Electron 40)
- **Tech Stack:** React 19, TypeScript, SQLite (Drizzle ORM), sqlite-vec, Redux Toolkit, Tailwind CSS v4

---

## 2. Documentation Structure

Organize Fumadocs pages into the following hierarchy. Each heading below is a page (or page group). The **slug** is the URL path.

```
docs/
  getting-started/
    introduction          # What Jinzo is
    installation          # How to install/build
    quickstart            # First-time setup walkthrough
  features/
    chat                  # Chat interface
    workspaces            # Copilot & Claude workspaces
    agents                # Copilot and Claude agents
    file-explorer         # Workspace file browser
    terminal              # Embedded terminal
    diffs                 # Git diff tracking
    reviews               # Code reviews / notes
    journal               # Rich text journal
    moods                 # Profiles & system prompts
    feed                  # Home feed / timeline
    tasks                 # Task management
    search                # Vector & keyword search
  integrations/
    overview              # How connections work
    github                # GitHub setup & features
    linear                # Linear setup & features
    jira                  # Jira setup & features
    asana                 # Asana setup & features
    notion                # Notion setup & features
    raindrop              # Raindrop setup & features
    rss                   # RSS setup & features
    hackernews            # HackerNews setup & features
    spotify               # Spotify setup & features
    apple-music           # Apple Music setup & features
    podcasts              # Podcasts setup & features
    youtube               # YouTube setup & features
  architecture/
    overview              # High-level architecture
    main-process          # Main process & modules
    renderer              # Renderer & Redux
    ipc                   # IPC conventions
    database              # Schema & migrations
    providers             # Provider adapter system
  configuration/
    settings              # App settings
    claude-settings       # Claude agent config
    copilot-settings      # Copilot agent config
    mcp-servers           # MCP server config
```

---

## 3. Page Content Guide

### 3.1 Getting Started

#### Introduction (`getting-started/introduction`)

Jinzo is an Electron desktop application that brings together:

- **AI Chat** — Conversations with LLMs through Ollama with RAG-augmented context from your synced knowledge base.
- **Agent Workspaces** — Run GitHub Copilot CLI or Claude Code agents inside workspaces linked to local git repos. Agents can read files, run commands, write code, and track diffs.
- **Knowledge Hub** — Sync and unify content from 12+ external services (GitHub issues, Linear tickets, Notion pages, RSS feeds, bookmarks, podcasts, videos, etc.) into a single searchable entity store.
- **Journal** — Rich text editor (BlockNote) with revision history for personal notes and documentation.
- **Moods / Profiles** — Define named configurations that control the system prompt, model, theme, connected services, and tool permissions. Switch contexts instantly.

The app runs fully local. SQLite database with sqlite-vec for vector search. No cloud backend required (external services are optional integrations).

#### Installation (`getting-started/installation`)

**Prerequisites:**
- Node.js 20+
- npm
- Ollama (for chat features) — `brew install ollama && ollama serve`
- Claude CLI (for Claude agent) — requires Anthropic subscription
- GitHub Copilot CLI (for Copilot agent) — requires GitHub Copilot subscription

**Steps:**
```bash
git clone <repo-url>
cd jinzo
npm install
npm run db:push      # Initialize dev database
npm run db:seed      # Seed default apps and connections
npm start            # Start development server
```

**Build for distribution:**
```bash
npm run package      # Package for current platform
npm run make         # Create distributable
```

**Database paths:**
- Development: `.data/jinzo.db`
- Production: `~/Library/Application Support/jinzo/jinzo.db`

#### Quickstart (`getting-started/quickstart`)

1. Launch Jinzo — you land on the Home page with a chat input.
2. **Set up Ollama** — Make sure `ollama serve` is running. The chat feature uses Ollama for LLM inference.
3. **Start a chat** — Type a message on the Home page. A chat session is created automatically with streaming responses.
4. **Connect a service** — Go to Settings > Apps and connect GitHub, Linear, or another service. Jinzo syncs your issues, bookmarks, articles, etc.
5. **Create a workspace** — Link a local git repository. Choose Copilot or Claude as your agent provider.
6. **Run an agent task** — Open a workspace, type a goal (e.g., "Fix the login bug"), and the agent will read files, write code, and run commands.
7. **Review diffs** — After a run, check the Changes tab in the workspace sidebar to see what the agent modified.

---

### 3.2 Features

#### Chat (`features/chat`)

The chat interface provides direct conversation with LLMs.

**Capabilities:**
- Create chat sessions with an initial query
- Streaming responses from Ollama
- Auto-generated session titles based on conversation content
- Manual title editing
- Message persistence with full history
- Provider and model tracking per session and per message
- System prompt snapshots for reproducibility
- Observability: trace IDs, latency (ms), input/output token counts

**Message roles:** user, assistant, system, tool

**Chat configuration:**
- Model selection
- System prompt override
- Stop sequences
- Provider config

**Data model:**
- `chatSessions` — id, title, providerId, modelId, moodId, systemPromptSnapshot, providerConfigSnapshot, createdAt, updatedAt
- `chatMessages` — id, sessionId, role, content, providerId, modelId, traceId, latencyMs, inputTokens, outputTokens, createdAt

#### Workspaces (`features/workspaces`)

Workspaces are the core unit for agent-assisted development. Each workspace is linked to a local git repository.

**Workspace properties:**
- Name
- Root path (absolute path to local git repo)
- Repository URL
- Default branch
- Archived flag

**Workspace UI (shared between Copilot and Claude routes):**
- **Main area:** Agent event stream showing logs, tool calls, artifacts, commands
- **Input bar:** Submit goals/instructions to the agent
- **Sidebar tabs:**
  - **Files** — File explorer tree for browsing and selecting context files
  - **Changes** — Git diffs from recent agent runs
  - **Reviews** — Code review notes

**Workspace resources:** Link external entities (GitHub issues, Linear tickets, etc.) to a workspace for context.

**Context system:** Before submitting a goal, users can attach:
- Context files (from file explorer)
- Context issues (from linked workspace resources)
- Notes (from review tabs)

#### Agents (`features/agents`)

Jinzo supports two agent runtimes that share the same workspace UI:

**GitHub Copilot CLI** (`/copilot/:workspaceId`)
- Provider ID: `copilot_cli`
- SDK: `@github/copilot-sdk`
- Connection: stdio or port-based
- Models: Claude Opus 4.5, Claude Sonnet 4.5, Claude Haiku 4.5
- Capabilities: streaming, tool calling, session resume, workspace awareness
- Timeout: 5 minutes default

**Claude Code** (`/claude/:workspaceId`)
- Provider ID: `claude_code`
- SDK: `@anthropic-ai/claude-agent-sdk`
- Authentication: Claude CLI (Anthropic subscription)
- Models: Claude Sonnet 4.5, Claude Opus 4.5, Claude Haiku 4.5
- Capabilities: streaming, tool calling with interactive approval, session resume, MCP server integration, skills discovery, structured outputs, subagents/delegation, hooks
- Timeout: 10 minutes default

**Tool approval system (Claude only):**
- Pre-approved tools (no dialog): Bash, Read, Glob, Grep, LSP, Task tools, WebFetch, WebSearch, NotebookEdit, all MCP tools (mcp__*)
- All other tools trigger an interactive approval dialog
- Permission modes: default, acceptEdits, bypassPermissions, plan

**Run lifecycle:**
1. Create run with workspace, provider, model, and goal
2. Capture git HEAD sha as base reference
3. Start run — status becomes "running"
4. Stream events: status changes, logs, artifacts, tool calls, commands, subagent activity
5. Complete/fail/cancel — record end time
6. Compute and persist git diff since base ref
7. Optionally archive run

**Run statuses:** queued, running, succeeded, failed, canceled

**Run artifacts (what the agent produced):**
- Kinds: patch, file, log, report, command_result, result
- Include path, content, and metadata

**Run commands (terminal commands executed):**
- Statuses: queued, running, done, error, canceled
- Capture: command, cwd, stdout, stderr, exit code

**Tool calls (invocation log):**
- Statuses: queued, running, done, error, canceled
- Track: tool name, input, output, error, latency, cost
- Support nested/parent tool calls

#### File Explorer (`features/file-explorer`)

Browse workspace files within the linked git repository.

- Tree view of the directory structure
- Click to view file contents
- Add files to agent context before submitting a goal
- Security: path traversal prevention, symlink escape detection, 2MB file size limit, binary file detection
- Workspace boundary enforcement — cannot navigate outside the root path

#### Terminal (`features/terminal`)

Embedded terminal inside workspace views.

- Full pseudoterminal via node-pty
- XTerm.js-based renderer
- Resize support
- IPC channels: create, write, resize, destroy
- Output streaming via `terminal:data` event

#### Diffs (`features/diffs`)

Track what agents changed in your codebase.

- Captures git HEAD sha when a run starts
- Computes unified diff after run completes
- Stores diff text, changed file list, and shortstat
- Deduplication via content hashing (identical diffs across runs are stored once)
- CodeMirror-based diff viewer in the workspace sidebar (Changes tab)
- Linked to both the workspace and the specific run

#### Reviews (`features/reviews`)

Workspace-level code review notes.

- Create review notes linked to a workspace or specific run
- Status workflow: open → in_review → approved / rejected
- Title, summary, metadata
- Visible in the workspace sidebar (Reviews tab)
- CRUD operations via IPC

#### Journal (`features/journal`)

Rich text editor for personal notes and documentation.

- BlockNote-based editor (block-style like Notion)
- Document revision tracking
- Markdown import/export
- Stored as entities with kind "doc"
- Route: `/journal/:id?`

#### Moods / Profiles (`features/moods`)

Named configurations that change how the app behaves.

**Mood properties:**
- Name, slug, description
- System prompt
- Model override
- Icon
- Theme config (JSON)
- UI config (JSON)
- Sort order

**Mood associations:**
- `moodConnections` — Which external services are visible in this mood
- `moodResources` — Which specific resources (repos, teams, feeds) are available
- `moodAppOverrides` — Override app-level settings per mood
- `moodToolPermissions` — Control which MCP tools are allowed/denied

Switch moods to instantly change your system prompt, connected services, theme, and tool access.

#### Feed (`features/feed`)

Timeline of events across all your synced content.

- `feedItems` table stores event log entries
- Event types: entity.created, entity.updated, task.completed, sync.error, etc.
- Item types: task, issue, doc, rss_article, etc.
- Each entry has: title, summary, URL, snapshot (JSON state at event time), metadata
- Indexed by: account+time, entity+time, connection+time, event type+time, item type+time

#### Tasks (`features/tasks`)

Actionable task management (domain view on entities).

- Statuses: todo, doing, done, canceled
- Due date
- Priority
- Labels (JSON array)
- Backed by the unified `entities` table with kind "task"

#### Search (`features/search`)

Find anything across your synced content.

- **Vector search:** sqlite-vec extension for embedding-based similarity search
- **Keyword search:** FTS5 full-text search on entities (migration 0005)
- **Entity chunks:** Content split into chunks with token counts, stored with embeddings in `vecEntityChunks`
- **RAG pipeline:** embed → chunk → retrieve → rerank → prompt-optimize
- Embedding generation via Ollama

---

### 3.3 Integrations

#### Overview (`integrations/overview`)

Jinzo connects to external services to sync your data into a unified entity store.

**How it works:**
1. Go to Settings > Apps
2. Connect a service (OAuth or API key)
3. Select resources to sync (repos, teams, feeds, playlists)
4. Jinzo fetches data and creates entities

**Sync system:**
- Connection states: active, revoked, error, disabled
- Sync state tracking: cursor, lastSyncAt, lastSuccessAt, lastErrorAt, backoffUntil, etag
- Produces `EntityInput[]` which get persisted to the `entities` table
- Encrypted token storage with key rotation support

**Outbox (offline-first):**
- Write actions (e.g., update a GitHub issue) go through an outbox
- Action types: github.issue.update, linear.issue.create, etc.
- Statuses: queued, running, done, error
- Retry logic with attempts counter and nextRunAt scheduling

Each integration page below should document: what it syncs, how to authenticate, what resources are available, and any limitations.

#### GitHub (`integrations/github`)
- **Auth:** OAuth token
- **Syncs:** Issues and pull requests from selected repositories
- **Entity kind:** issue
- **Resource kind:** github_repo
- **Data:** Issue title, body, state (open/closed), labels, assignees, number, repo

#### Linear (`integrations/linear`)
- **Auth:** API key
- **SDK:** @linear/sdk
- **Syncs:** Issues from selected teams
- **Entity kind:** issue
- **Resource kind:** linear_team
- **Data:** Issue title, description, state, labels, priority, number (e.g., ABC-123)

#### Jira (`integrations/jira`)
- **Syncs:** Issues from Jira projects
- **Entity kind:** issue

#### Asana (`integrations/asana`)
- **Syncs:** Tasks from Asana projects
- **Entity kind:** task

#### Notion (`integrations/notion`)
- **Syncs:** Pages and documents
- **Entity kind:** doc

#### Raindrop (`integrations/raindrop`)
- **Syncs:** Bookmarks
- **Entity kind:** bookmark

#### RSS (`integrations/rss`)
- **Syncs:** Feed articles
- **Entity kind:** rss_article

#### HackerNews (`integrations/hackernews`)
- **Syncs:** Saved/favorited items
- **Entity kind:** hn_item

#### Spotify (`integrations/spotify`)
- **Syncs:** Playlists and tracks
- **Entity kind:** playlist

#### Apple Music (`integrations/apple-music`)
- **Syncs:** Playlists and tracks
- **Entity kind:** playlist

#### Podcasts (`integrations/podcasts`)
- **Syncs:** Podcast episodes
- **Entity kind:** podcast_episode

#### YouTube (`integrations/youtube`)
- **Syncs:** Videos
- **Entity kind:** video

---

### 3.4 Architecture

#### Overview (`architecture/overview`)

```
┌─────────────────────────────────────────────────────┐
│                    Renderer (React 19)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Routes   │ │  Redux   │ │ Features │ │  RAG   │ │
│  │ (Router)  │ │ (RTK-Q)  │ │ (UI)     │ │Pipeline│ │
│  └────┬─────┘ └────┬─────┘ └──────────┘ └────────┘ │
│       │             │                                │
│       └──────┬──────┘                                │
│              │ window.api.*                           │
├──────────────┼───────────────────────────────────────┤
│          Preload (ipcRenderer.invoke)                │
├──────────────┼───────────────────────────────────────┤
│              │ ipcMain.handle                         │
│  ┌───────────▼──────────────────────────────────────┐│
│  │              Main Process Modules                ││
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐ ││
│  │  │ Chat │ │ Runs │ │ Sync │ │ MCP  │ │  Git  │ ││
│  │  │      │ │      │ │      │ │      │ │       │ ││
│  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └───┬───┘ ││
│  │     │        │        │        │          │     ││
│  │     └────────┴────────┴────────┴──────────┘     ││
│  │                       │                          ││
│  │              ┌────────▼────────┐                 ││
│  │              │  SQLite + Drizzle│                 ││
│  │              │  + sqlite-vec    │                 ││
│  │              └─────────────────┘                 ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │           Provider Adapters                      ││
│  │  ┌─────────────┐    ┌──────────────┐            ││
│  │  │ Copilot SDK │    │ Claude Agent  │            ││
│  │  │ (stdio/port)│    │ SDK (CLI)     │            ││
│  │  └─────────────┘    └──────────────┘            ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

#### Main Process (`architecture/main-process`)

Entry point: `src/main/index.ts` — initializes database, registers IPC handlers, creates the BrowserWindow.

**Module architecture** — each domain follows a layered pattern:

| Layer | File | Role |
|-------|------|------|
| IPC | `{name}.ipc.ts` | Register/unregister `ipcMain.handle` channels |
| Controller | `{name}.controller.ts` | Returns `Promise<ServiceResponse<T>>` |
| Service | `{name}.service.ts` | Business logic, uses `this` for sibling calls |
| Repository | `{name}.repo.ts` | Drizzle queries, calls `getDb()` per method |
| DTO | `{name}.dto.ts` | Types and formatter functions |
| Validation | `{name}.validation.ts` | Allowlist validation (no zod/yup) |

All layers are **plain object literals** (no classes, no DI).

**Modules:**
- `account` — User account management
- `chat` — Chat sessions and messages
- `connections` — External service credentials and resources
- `entities` — Unified content store
- `feed` — Timeline events
- `fileExplorer` — Secure filesystem access
- `git` — Git operations via simple-git
- `journal` — Documents and revisions
- `mcp` — Model Context Protocol tools
- `moods` — Profile configurations
- `providers` — LLM/agent runtime management + adapters
- `reviews` — Code review notes
- `runs` — Agent run lifecycle and events
- `sync` — External service data fetching
- `terminal` — Pseudoterminal via node-pty
- `tools` — Tool registry and call tracking
- `workspaceDiffs` — Git diff capture and storage
- `workspaceResources` — Entity-workspace linking
- `workspaces` — Workspace management

#### Renderer (`architecture/renderer`)

React 19 app with HashRouter.

**State management:**
- RTK Query with custom `ipcBaseQuery` for server state (no HTTP — all IPC)
- Redux slices for UI state: `chatSlice`, `moodSlice`, `appSettingsSlice`, `workspaceSlice`
- API files: `src/renderer/lib/redux/api/{name}Api.ts` — use `baseApi.injectEndpoints()`

**Workspace slice state:**
```typescript
{
  activeWorkspaceId: string | null
  selectedModelByProvider: Record<string, string>
  selectedProviderId: string
  thinkingEnabled: boolean
  selectedFile: FileNode | null
  selectedFileContent: FileContentResponse | null
  isLoadingFileContent: boolean
  fileContentError: string | null
  activeTab: "editor" | string
  contextFiles: FileNode[]
  contextIssues: ContextIssue[]
  openIssueTabs: IssueWithEntity[]
  openNoteTabs: ReviewTab[]
  pendingGoal: string | null
}
```

**Feature directories:** `src/renderer/features/{name}/components/`
- `chat/` — Chat UI components
- `home/` — Home page
- `journal/` — Journal editor
- `settings/` — Settings pages and app connection modals
- `workspace/` — Workspace UI (events, input, sidebar, tabs, file explorer, tools, diffs, reviews, terminal)

**Routing:** HashRouter with routes at `src/renderer/routes/`
- `/` → Home
- `/chat/:id` → Chat
- `/copilot/:workspaceId` → Copilot workspace
- `/claude/:workspaceId` → Claude workspace
- `/journal/:id?` → Journal
- `/settings` → Settings (with `?section=` param)

**Styling:** Tailwind CSS v4 (PostCSS-based), `@/` alias maps to `src/renderer/`

#### IPC (`architecture/ipc`)

Channel format: `"domain:action"` (e.g., `"chat:send"`, `"entities:getAll"`)

Channels must be kept in sync across three files (no shared registry):
1. `src/preload/index.ts` — `ipcRenderer.invoke("domain:action")`
2. `src/main/modules/{name}/{name}.ipc.ts` — `ipcMain.handle("domain:action")`
3. `src/renderer/lib/redux/api/{name}Api.ts` — `{ handler: "domain:action" }`

All responses use `ServiceResponse<T>`:
```typescript
{ success: true, data: T }
{ success: false, error: string }
```

**IPC namespaces:** chat, entities, feed, sync, runs, workspaces, workspaceResources, workspaceDiffs, reviews, fileExplorer, git, terminal, providers, tools, moods, journal, connections, account, platform, shell

#### Database (`architecture/database`)

**Engine:** better-sqlite3 with Drizzle ORM, sqlite-vec extension

**Conventions:**
- Text primary keys (UUIDs)
- Timestamps: `integer("col", { mode: "timestamp" })` with `default(sql\`(unixepoch())\`)`
- Snake_case SQL ↔ camelCase TypeScript (Drizzle handles mapping)
- Booleans: `integer("col", { mode: "boolean" })`
- Enums: `text("col", { enum: [...] })`
- Updates must manually set `updatedAt: sql\`(unixepoch())\``
- Index naming: `idx_{table}_{col}`, unique: `uniq_{table}_{desc}`

**Schema file:** `src/main/db/schema.ts`

**Tables:**
| Table | Purpose |
|-------|---------|
| `providers` | LLM/agent runtimes |
| `entities` | Unified content (tasks, issues, docs, bookmarks, articles, etc.) |
| `entityChunks` / `vecEntityChunks` | Chunked content with embeddings |
| `connections` / `connectionResources` | External services and their resources |
| `connectionTokens` | Encrypted OAuth/API tokens |
| `connectionSyncState` | Sync cursors and state |
| `feedItems` | Timeline events |
| `chatSessions` / `chatMessages` | Chat history |
| `moods` + associations | Profile configurations |
| `runs` / `runContext` / `runArtifacts` / `runCommands` | Agent run data |
| `tools` / `toolCalls` / `moodToolPermissions` | Tool registry |
| `workspaceDiffs` | Git diffs per run |
| `reviews` | Code review notes |
| `mcpServers` | MCP server registry |
| `tasks` | Task domain view |
| `issues` | Issue domain view |
| `playlistItems` | Ordered collections |
| `outbox` | Offline-first action queue |
| `documentRevisions` | Journal revision history |

**Migrations:** SQL files in `drizzle/` directory, bundled as `extraResource` in production.

#### Providers (`architecture/providers`)

**Provider adapter pattern:**

```
providers/
  adapters/
    adapter.types.ts      # WorkRunAdapter interface
    adapter.factory.ts    # Factory: provider type → adapter instance
    claude.adapter.ts     # Claude Code via @anthropic-ai/claude-agent-sdk
    copilot.adapter.ts    # GitHub Copilot via @github/copilot-sdk
```

**WorkRunAdapter interface** — unified abstraction for agent runtimes:
- `execute(params)` — Start a new agent run
- `continue(params)` — Resume an existing session
- `abort()` — Stop the running session
- `canResume(sessionId)` — Check if a session can be resumed
- `getModels()` — List available models
- `getCommands()` — List available commands
- `getSkills()` — List available skills

**Event types emitted during runs:**
- `status` — Run status changes
- `log` — Text output from the agent
- `tool_call` — Tool invocations with input/output
- `command` — Terminal commands executed
- `artifact` — Files written or patches created
- `subagent` — Delegated sub-tasks

**Tool approval (Claude adapter):**
- Pre-approved list bypasses the dialog
- Other tools trigger `runs:toolApprovalRequest` IPC event
- Renderer shows approval dialog
- User response sent back via `runs:toolApprovalResponse`
- `user-input-broker.ts` manages the request/response queue

---

### 3.5 Configuration

#### Settings (`configuration/settings`)

**General settings:**
- Display name, email, company, job title
- Timezone (UTC, Europe/London, Paris, Berlin, Istanbul, Dubai, Singapore, Tokyo, Sydney, New York, Los Angeles)
- Locale (en-US, tr, de, es, fr, ru, pt-BR, it, nl, sv)
- Website, avatar URL, bio
- Theme: light, dark, system

#### Claude Settings (`configuration/claude-settings`)

- **Permission mode:** default, acceptEdits, bypassPermissions, plan
- **Structured outputs:** Configure JSON schema for structured responses
- **Settings sources:**
  - User: `~/.claude/settings.json`
  - Project: `.claude/settings.json`
  - Local: `.claude/settings.local.json`
- **MCP servers:** Auto-loaded from settings files
- **Skills:** Discovered from `~/.claude/skills/` and `.claude/skills/`

#### Copilot Settings (`configuration/copilot-settings`)

- Binary path configuration
- CLI URL or stdio/port configuration
- Log level
- Auto-restart toggle

#### MCP Servers (`configuration/mcp-servers`)

- Stored in `mcpServers` table
- Transport types: stdio, http, ws
- Status tracking
- Metadata (JSON)
- Used by Claude adapter for extended tool capabilities

---

## 4. Fumadocs Implementation Notes

### Setup
- Use `fumadocs-core` and `fumadocs-ui` with Next.js
- Place the docs site in a separate directory (e.g., `docs-site/`) since Jinzo itself is an Electron app
- Use MDX for content pages

### Design
- Dark theme default (matches Jinzo's dev-tool aesthetic)
- Sidebar navigation matching the structure in Section 2
- Code blocks with syntax highlighting for TypeScript, SQL, bash
- Architecture diagrams can use ASCII art or mermaid

### Search
- Enable Fumadocs built-in search across all docs pages

### Key dependencies
```
fumadocs-core
fumadocs-ui
fumadocs-mdx
next
react
tailwindcss
```
