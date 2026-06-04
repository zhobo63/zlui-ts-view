# zlui-ts-view

A web-based UI editor/viewer for the **zlui-ts** component framework, built with TypeScript + ImGui (WebGL) + a lightweight Node.js server. It provides a VS Code-like dark-themed interface where you can load `.ui` files, browse an object tree, and edit properties in real time — all rendered on an HTML5 Canvas.

## Features

- **Canvas rendering** via ImGui + WebGL backend
- **Scroll & zoom** — mouse wheel scrolling with custom DOM scrollbars, plus scale adjustment (slider + presets)
- **Drag & drop upload** — drop `.ui` files directly onto the left panel to upload and load them
- **Object tree browser** — expandable/collapsible hierarchy of all UI components in the loaded file
- **Property editor** — right panel shows editable properties (position, size, visibility, alpha, color, text, etc.) with live feedback
- **File management** — list uploaded files, click to load, clear button to delete all uploads

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Left Panel  │────▶│ Canvas       │◀────│ Right Panel │
│ (file list, │     │ Renderer     │     │ (properties)│
│ object tree,│     │              │     │             │
│ scale ctrl) │     │              │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
                         │
                    Node.js Server
                   (static + API)
```

### Source files (`src/`)

| File | Class | Description |
|------|-------|-------------|
| `index.ts` | `App` | Application bootstrap. Wires up the three panels via callbacks, handles canvas resize. |
| `canvas-renderer.ts` | `CanvasRenderer` | ImGui initialization, render loop (30 FPS cap, dirty-only redraw), scroll system, zoom/scale, UI file loading (`zlUIMgr.Load()`). |
| `leftpanel.ts` | `LeftPanel` | File list from `/api/dir`, drag & drop upload via `/api/upload`, clear uploads via `/api/clear`, recursive object tree with expand/collapse. |
| `rightpanel.ts` | `RightPanel` | Property editor with 20+ common properties (text, number, range, color, select inputs), dynamic property listing, live change callbacks. |

### Server (`server.js`)

A zero-dependency Node.js HTTP server that:

- Serves static files from the `www/` directory
- **`POST /api/upload`** — parses multipart/form-data (no external deps) and saves files to `www/upload/`
- **`POST /api/clear`** — deletes all files in `www/upload/`
- **`GET /api/dir?path=upload`** — returns JSON listing of directory contents
- **`GET /api/file?path=...`** — serves raw file content

### Build & config

| File | Purpose |
|------|---------|
| `package.json` | Dependencies (`@zhobo63/imgui-ts`, `@zhobo63/zlui-ts`, TypeScript, webpack) and npm scripts |
| `tsconfig.json` | ES6 target, bundler module resolution, sourcemaps enabled |
| `webpack.config.js` | Entry: `./src/index.ts` → output to `www/`. Handles `.ts` via ts-loader, assets (fonts/images) as inline/file. |
| `config.json` | Server config — `Port` (default 5600), `MaxUploadSize` (default 5MB) |

## Getting Started

```bash
# Install dependencies
npm install

# Build (development with sourcemaps)
npm run build:dev

# Or watch mode (auto-rebuild on changes)
npm run build:dev_watch

# Start the server
npm start
```

Then open **http://localhost:5600** in your browser.

## Data Flow

```
Left Panel (select file / drag & drop upload)
    ↓ onFileSelected → CanvasRenderer.loadUI()
    ↓ onFileLoaded → LeftPanel.updateObjectTree()
    ↓
Right Panel (show properties) ← onSelectObject ← click tree node
    ↓ onPropertyChange → mgr.isDirty = true → CanvasRenderer redraws
```

## Dependencies

- **@zhobo63/imgui-ts** — ImGui TypeScript bindings with WebGL rendering backend
- **@zhobo63/zlui-ts** — ZLUI cross-platform UI framework (component tree, layout system)
- **@zhobo63/zlui-ts-spine** — Spine animation support for zlui-ts

## License

MIT
