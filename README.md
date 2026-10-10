# Paramyra

**Where mathematics comes alive.** Interactive Mathematics & Physics Studio: explore, simulate, and create.

[![CI](https://github.com/GendByteMaster/Paramyra/actions/workflows/ci.yml/badge.svg)](https://github.com/GendByteMaster/Paramyra/actions/workflows/ci.yml)


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

The Gallery, Playground, and Studio share one scene schema, mathematical functions, and rendering system. The scene engine has no dependency on Next.js or UI animation libraries. Local projects are stored in the current browser only; authentication, online publishing, keyframes, and 3D are future milestones. See [architecture](docs/ARCHITECTURE.md).

MIT licensed.