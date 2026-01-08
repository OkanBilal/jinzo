# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview
Jinzo is an Electron application built with Vite. It uses Electron Forge for building, packaging, and distributing the application.

## Architecture

### Process Model
This application follows Electron's standard multi-process architecture:

- **Main Process** (`src/main.js`): Manages application lifecycle, creates browser windows, and handles native OS interactions. Entry point configured in `forge.config.js` and uses Vite for bundling.
- **Renderer Process** (`src/renderer.js`): Runs the web page UI. Loaded via `index.html` and bundled separately through Vite's renderer configuration.
- **Preload Script** (`src/preload.js`): Bridges main and renderer processes. Currently empty but intended for exposing controlled APIs to the renderer context. Configured with its own Vite build target.

### Build System
Uses **Electron Forge with Vite plugin** for development and production builds:
- Three separate Vite configurations (`vite.main.config.mjs`, `vite.preload.config.mjs`, `vite.renderer.config.mjs`) for each process context
- Development mode provides hot module replacement for the renderer process
- Production builds are output to `.vite/` directory

### Packaging
Configured in `forge.config.js` with makers for multiple platforms:
- **Squirrel** (Windows)
- **ZIP** (macOS)
- **DEB** (Debian/Ubuntu)
- **RPM** (Fedora/RedHat)

ASAR packaging is enabled for production builds.

## Commands

### Development
```bash
npm start
```
Starts the Electron app in development mode with Vite dev server and hot reload.

### Build & Package
```bash
npm run package
```
Creates a distributable package for your current platform (does not create installers).

```bash
npm run make
```
Creates platform-specific distributables (installers/packages) defined in `forge.config.js`.

### Publishing
```bash
npm run publish
```
Publishes the application (requires publisher configuration in `forge.config.js`).

### Linting
No linting is currently configured. The `npm run lint` command is a placeholder.

## Key Files

- `src/main.js` - Main process entry point; creates windows and manages app lifecycle
- `src/renderer.js` - Renderer process entry point; imports `index.css` for styling
- `src/preload.js` - Preload script (currently empty)
- `index.html` - Application HTML template
- `forge.config.js` - Electron Forge configuration for build and packaging
- `vite.*.config.mjs` - Vite configurations for main, preload, and renderer processes

## Important Considerations

### Security
- The application uses a preload script architecture for security. To expose APIs from main to renderer, add them to `src/preload.js` using `contextBridge` rather than enabling `nodeIntegration`.
- DevTools are currently opened by default in `main.js` (line 28). Remove this for production.

### Adding Dependencies
- Main process dependencies: Add to regular `dependencies` or `devDependencies`
- Renderer process dependencies: Add to `dependencies` (will be bundled by Vite)
- Native modules: Automatically unpacked by `@electron-forge/plugin-auto-unpack-natives`

### Multi-Platform Development
When adding platform-specific code, use `process.platform` checks. The app already includes macOS-specific window management behavior (lines 37-43 in `main.js`).
