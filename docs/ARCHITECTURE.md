# Paramyra architecture — Foundation

## Boundaries

- App Router: routing, page composition, metadata, and (later) server APIs.
- Scene Document: a versioned, Zod-validated plain JSON model (currently schema v1).
- Math core: deterministic pure functions; no React imports, DOM, or arbitrary evaluation.
- Renderer: Canvas 2D adapter, independently replaceable by SVG/Three adapters.
- UI features: Gallery, Playground, Studio depend on the same scene schema and rendering contract.
- Persistence: browser localStorage for this small foundation only; move larger documents to IndexedDB and later server persistence.

## Deliberate limits

The first working version has one active scene and controls, **not** multi-layer editing, visual expression parsing, physics, 3D, online accounts, or video export. These are milestones, not implemented features.

## Security and performance

- Never use eval/new Function on user expressions.
- Validate JSON imports with strict schemas and bounded numeric ranges.
- Do not import large Animata/UI effects into the mathematical render loop.
- Keep frame timing within requestAnimationFrame, not React state.
- Respect reduced-motion preferences and cap Canvas pixel ratio.
- Schema migrations and deterministic simulation seeds will be needed before introducing physics/keyframes.
