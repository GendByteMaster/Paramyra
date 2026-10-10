# Paramyra Studio v0.9 — Formula Editor

**Base branch:** dev/studio-professional-canvas-v08 (Draft PR #8)
**Feature branch:** dev/studio-formula-editor-v09 (stacked Draft)
**Release policy:** no production merge or claim of v0.8 visual acceptance until manual review succeeds.

## User-facing scope
- Add **Custom Formula** as a new layer (or convert the selected layer in the Inspector).
- Explicit: `y=a*sin(b*x+t)` (world-space X domain).
- Parametric: `x=a*cos(b*u+t)`, `y=a*sin(c*u)`.
- Polar: `r=a*cos(b*theta+t)` (ASCII `theta` variable).
- Edit bounded domain [-20,20], parameters a/b/c [-10,10] and stroke width. Expression maximum: 160 characters.
- Valid expressions preview immediately; invalid partial expressions show inline errors and preserve the previously committed valid document.
- Existing pan, fit, grid, layer composition, drag, Undo/Redo, JSON import/export and saved presets remain compatible.

## Security boundary
- No eval, new Function, JavaScript execution, remote dependencies, generated runtime code or user-supplied function calls.
- Numeric AST consists only of immutable numeric literals, scoped variables, unary/binary arithmetic and an allowlist of one-argument math functions.
- Supported functions: sin/cos/tan, asin/acos/atan, sqrt, abs, exp, ln, log, floor, ceil.
- Operators: +, -, *, /, ^. Constants: pi and e. Multiplication must be explicit.
- Parser limits: 160 source characters, 100 tokens, 96 AST nodes, recursion depth 24.
- Runtime output must be finite and within 1e6 magnitude; invalid domain points produce NaN gaps.
- Document parser enforces schema v3, unique layer IDs, 1–12 layers, finite and bounded parameters; strict v1 and v2 migration.
- Import size limit remains 256 KiB; no network persistence. All stored JSON is treated as untrusted at load.
- Strict formula-mode variable scopes: x (explicit), u (parametric), theta (polar), plus t/a/b/c.

## Rendering and performance
- Formula layers use the existing world-space camera. They coexist with preset layers.
- Explicit graphs are sampled across the configured X-domain; parametric curves across U; polar across theta.
- Canvas2D renderer breaks polylines for invalid points and large discontinuities rather than drawing cross-asymptote strokes.
- Sampling is globally bounded around 10,000 segments across all visible layers for predictable multi-layer frame cost.
- Expressions are parsed once per formula text and variable scope via a bounded 96-entry cache. Expression runtime is deterministic for identical inputs.
- This is still a main-thread Canvas2D renderer, *not* a 3D engine or an accurate real-time numerical simulator.

## Migration
- New authoritative key: `paramyra.document.v3`; fallback reads strict `paramyra.document.v2` then `paramyra.scene.v1`.
- Custom preset key: `paramyra.presets.v3`; read-only fallback to the v2 key.
- Import of valid v1/v2 documents upgrades to schemaVersion=3, preserves original layer IDs, parameters, offsets, colors, visibility and opacity.
- Export always serializes strict v3 documents. Older storage keys are retained as non-destructive fallback; the application never overwrites v2 contents.

## Verification gates
- Lint, TypeScript strict, Vitest parser/security/domain/migration/integration tests.
- Next.js production build and Playwright Chromium desktop/mobile regression suites.
- Interactive UX acceptance at 1920×1080, 1365×768 and 390×844; check formula typing, mobile text selection, inline errors, fullscreen, multiple curves, Undo, preset migration and export.
- Performance stress: 12 simultaneous formula layers, worst-case tangent/discontinuity, long expressions, combined zoom/drag.
- Confirm CI on the exact final HEAD. Keep Draft until manual verification.

## Excluded
Symbolic algebra/derivatives, piecewise syntax, implicit equations, units/dimensional analysis, cross-layer parameter references, scripted functions, collaborative editing, 3D, GPU/WASM expression compilation, simulation solvers, keyframe authoring and cloud storage.
