# Paramyra

**Where mathematics comes alive.** Interactive Mathematics & Physics Studio: explore, simulate, and create.

[![CI](https://github.com/GendByteMaster/Paramyra/actions/workflows/ci.yml/badge.svg)](https://github.com/GendByteMaster/Paramyra/actions/workflows/ci.yml)


## Studio v1.0 — M4.1 Project Integrity (development branch)

M4.1 stores Scene, Node Graph, authored Timeline keyframes, and Coursework together inside each Studio project. Legacy project registries (v1) and graph-scoped coursework drafts migrate to versioned v2 project snapshots without executing imported content or erasing old keys. Project JSON v2 includes Coursework; v1 JSON imports remain supported. Timeline playhead is session-only; the durable animation data consists of document duration and keyframes.

See [M4.1 design and verification notes](docs/STUDIO_PROJECT_INTEGRITY_M41.md).

## Studio v0.9 — Formula Editor (historical milestone)

Studio v0.9 extends v0.8 with user-authored mathematical expressions:
- Explicit graphs `y=f(x,t)`, parametric curves `x=f(u,t), y=g(u,t)`, and polar curves `r=f(theta,t)`.
- Live Inspector formula editor with editable domain and parameter sliders `a`, `b`, `c`.
- Bounded AST parser. Approved math functions and operators only; **no JavaScript eval/new Function**, no imports or arbitrary code.
- Strict `MathDocument v3` with validated formula layers and migration of v1/v2 documents.
- World-space renderer and hit testing handle invalid domains by introducing curve gaps; animations remain deterministic at explicit time.
- Total curve sampling is budgeted across visible layers.

Formula changes only reach the scene when they pass validation. Invalid drafts remain visible in the editor with errors while the last valid formula continues rendering. Browser storage remains local and non-durable.

See [Studio v0.9 design, security and review gates](docs/STUDIO_V09.md). This change is stacked on v0.8 and must remain Draft until v0.8 visual acceptance and dependency merges.

## Studio v0.8 — Professional Canvas (draft preview)

Building on Studio v0.7, the canvas now provides:
- Selection of visible mathematical curves by stroke hit-testing, with topmost-layer priority.
- Direct curve dragging to change per-layer offsets (bounded by the existing v2 schema), including Undo/Redo.
- **Select** and **Pan** tools. In Select mode, drag blank canvas or hold **Alt** to pan; middle-button drag also pans. Focus the canvas and use arrow keys to nudge the selected layer (Shift = larger step).
- One shared mathematical world coordinate system for renderer, hit testing, responsive 1/2/5 Cartesian grid and numeric ticks.
- Wheel zoom anchored under the pointer (0.1–8×) and true **Fit scene**, computed from visible geometry rather than resetting to 100%.
- Independent **Reset layer** (restores only selected layer's parameters/offset) and **Reset camera** controls. Layer reset retains other layers and custom style.

The v0.8 branch is stacked on the v0.7 Draft PR. Manual browser acceptance and final CI on merged HEAD remain required before release.

See [Studio v0.8 architecture and verification checklist](docs/STUDIO_V08.md).

## Studio v0.7 — layered workspace (preview)

The Studio now uses a separate, strict **SceneDocument v2** model:
- Up to 12 independent layers: select, add, duplicate, reorder, hide, delete and tune per-layer style and parameters.
- Undo/Redo with a bounded history (60 commits) and coalesced repeated parameter edits.
- Timeline: deterministic parametric scene time, pause/play, seek, duration and speed control. **No keyframe authoring yet.**
- Canvas camera: drag-to-pan, wheel/button zoom, fit/reset, grid, axes, and glow/clean line style.
- Local saved presets (up to 12), versioned JSON import/export and migration of valid legacy v1 scenes.

Persistence remains in browser localStorage, not cloud storage. Do not treat a browser reset as a durable project backup: export JSON before clearing site data.

See [v0.7 architecture and release gates](docs/STUDIO_V07.md).

## Foundation scope

- Next.js 16 App Router, React 19, TypeScript (strict), Tailwind CSS v4
- Gallery with three mathematical scene presets
- Shared deterministic math functions and Canvas 2D renderer
- Interactive Playground and Studio with live parameter editing
- Local save/load, JSON import/export, reduced-motion support
- Apple HIG-inspired accessible and adaptive UI
- Animata selectively adapted for UI-only effects; see [integration policy](docs/ANIMATA.md)

## Running

Node.js 22 recommended.

    npm install
    npm run dev

Open http://localhost:3000. Verify with:

    npm run lint
    npm run typecheck
    npm test
    npm run build
    npx playwright install chromium
    npm run test:e2e

### Deployment

Import this repository into Vercel and select **Next.js** with the repository root. No environment variables are required for the foundation. Vercel deployment is not yet confirmed.

### Project principles

Gallery and Playground use the shared math/renderer foundation; Studio uses the validated MathDocument v3 and a separate versioned v2 project registry. Timeline keyframes, React Flow Node Graph and Coursework are supported. The mathematical engine is independent from Next.js; projects remain browser-local, with no cloud sync, collaboration or 3D. See [architecture](docs/ARCHITECTURE.md).

MIT licensed.