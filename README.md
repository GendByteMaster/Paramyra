# Paramyra

**Where mathematics comes alive.** Interactive Mathematics & Physics Studio: explore, simulate, and create.

[![CI](https://github.com/GendByteMaster/Paramyra/actions/workflows/ci.yml/badge.svg)](https://github.com/GendByteMaster/Paramyra/actions/workflows/ci.yml)

## Foundation scope

- Next.js 16 App Router, React 19, TypeScript (strict), Tailwind CSS v4
- Gallery with three mathematical scene presets
- Shared deterministic math functions and Canvas 2D renderer
- Interactive Playground and Studio with live parameter editing
- Local save/load, JSON import/export, reduced-motion support
- Apple HIG-inspired accessible and adaptive UI
- Animata reviewed as an **optional** source of UI-only effects; see [integration policy](docs/ANIMATA.md)

## Running

Node.js 22 recommended.

    npm install
    npm run dev

Open http://localhost:3000. Verify with:

    npm run lint
    npm run typecheck
    npm test
    npm run build

### Deployment

Import this repository into Vercel and select **Next.js** with the repository root. No environment variables are required for the foundation. Vercel deployment is not yet confirmed.

### Project principles

The Gallery, Playground, and Studio share one scene schema, mathematical functions, and rendering system. The scene engine has no dependency on Next.js or UI animation libraries. Local projects are stored in the current browser only; authentication, online publishing, keyframes, and 3D are future milestones. See [architecture](docs/ARCHITECTURE.md).

MIT licensed.