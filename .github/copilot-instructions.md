# Copilot Instructions — Jinzo

Jinzo is an Electron 40 desktop app (React 19 renderer, SQLite + Drizzle ORM, sqlite-vec for vector search). CommonJS package with ESM Vite configs (`.mjs`).

## Build & Test

```bash
npm start              # Dev server (full restart needed for preload changes)
npm run lint           # ESLint on src/
npm run lint:fix       # Auto-fix
npm run db:generate    # Generate Drizzle migrations from schema changes
npm run db:push        # Push schema to dev DB (.data/jinzo.db)
npm run db:seed        # Seed apps and connections
npm run db:clean:dev   # Reset dev database
npm run package        # Package for current platform
```

## Architecture

Three Electron processes with strict boundaries:

- **Main** (`src/main/`) — DB, IPC handlers, business logic in domain modules
- **Preload** (`src/preload/index.ts`) — typed `window.api` bridge, namespace-per-domain
- **Renderer** (`src/renderer/`) — React + Redux Toolkit + HashRouter, `@/` alias → `src/renderer/`

## Module Pattern (`src/main/modules/{name}/`)

Every backend domain uses this exact structure (see [src/main/modules/account/](src/main/modules/account/) as reference):

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

## IPC Convention

Channel format: `"domain:action"` (e.g. `"chat:send"`, `"entities:getAll"`). Channels must stay in sync across three files — there is no shared registry:

1. `src/preload/index.ts` — `ipcRenderer.invoke("domain:action")`
2. `src/main/modules/{name}/{name}.ipc.ts` — `ipcMain.handle("domain:action")`
3. `src/renderer/lib/redux/api/{name}Api.ts` — `{ handler: "domain:action" }`

All IPC responses use `ServiceResponse<T>` envelope: `{ success: true, data }` or `{ success: false, error }`.

## Database (`src/main/db/schema.ts`)

- Text primary keys (UUIDs or string literals), timestamps as `integer("col", { mode: "timestamp" })` with `default(sql\`(unixepoch())\`)`
- Snake_case SQL columns, camelCase TypeScript — Drizzle handles mapping
- Booleans: `integer("col", { mode: "boolean" })`, enums: `text("col", { enum: [...] })`
- Updates must manually set `updatedAt: sql\`(unixepoch())\``
- Index naming: `idx_{table}_{col}`, unique: `uniq_{table}_{desc}`

## Frontend Conventions

- **Redux**: RTK Query with custom `ipcBaseQuery` (no HTTP), `baseApi.injectEndpoints()` per domain
- **Hooks**: `use-kebab-case.ts` filenames, `useCamelCase` export names
- **Components**: `kebab-case.tsx` filenames in feature dirs under `src/renderer/features/{name}/components/`
- **Routing**: HashRouter — routes at `/`, `/chat/:id`, `/copilot/:workspaceId`, `/claude/:workspaceId`, `/journal`, `/settings`
- **Styling**: Tailwind CSS v4 (PostCSS-based)

## Code Style

- Strict TypeScript, but `any` is allowed (`no-explicit-any: off`)
- Unused vars prefixed with `_` (warn, not error)
- No Prettier — formatting via editor settings + ESLint
- No `import React` needed (`react-jsx` transform)

## Gotchas

- Preload changes require full dev server restart
- Dual DB paths: `.data/jinzo.db` (dev) vs `~/Library/Application Support/jinzo/jinzo.db` (packaged)
- sqlite-vec native extension loaded at runtime for vector search
- Migration `.sql` files are copied into the build via Vite plugin and bundled as `extraResource`
