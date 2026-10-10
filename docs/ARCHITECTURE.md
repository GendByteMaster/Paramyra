# Paramyra architecture — Foundation

## Boundaries

- App Router: routing, page composition, metadata, and (later) server APIs.
- Scene Document: strict versioned Zod-validated JSON. Public gallery retains schema v1; Studio uses MathDocument v2, with migration of valid v1 scenes.
- Math core: deterministic pure functions; no React imports, DOM, or arbitrary evaluation.
- Math expressions: bounded AST parser and safe numeric evaluator; strict scope by formula mode, no code execution.
- Geometry: pure coordinate transforms, curve sampling (including custom formula layers), hit testing and camera-fitting independent of React.\n- Renderer: Canvas 2D adapter using that shared geometry. SVG/Three are potential future adapters, not implemented features.
- UI features: Gallery, Playground, Studio depend on the same scene schema and rendering contract.
- Persistence: browser localStorage for one current document and up to 12 user presets; use JSON export for backups. Future IndexedDB/cloud storage are not implemented.

## Deliberate limits

Studio v0.7 includes up to 12 layers, deterministic timeline playback, local presets and Undo/Redo. v0.8 adds direct manipulation, mathematical grid and geometry-driven Fit. Studio v0.9 adds bounded mathematical AST formulas and a validated v3 schema. Arbitrary JavaScript execution, inter-layer dependencies, keyframes, numerical physics, 3D, accounts and video export are not supported.

## Security and performance

- Never use eval/new Function on user expressions.
- Validate JSON imports with strict schemas and bounded numeric ranges.
- Do not import large Animata/UI effects into the mathematical render loop.
- Keep frame timing within requestAnimationFrame, not React state.
- Respect reduced-motion preferences and cap Canvas pixel ratio.
- Schema migrations and deterministic simulation seeds will be needed before introducing physics/keyframes.
