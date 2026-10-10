# Paramyra Studio v0.7 — architecture, migration and review gate

## Source-of-truth contracts
- src/core/scenes/schema.ts — **legacy single-scene v1**, still used by public gallery templates
- src/core/document/schema.ts — **v2 MathDocument**, with up to 12 explicitly bounded layers
- src/core/document/operations.ts — pure immutable layer operations
- src/core/document/history.ts — capped Undo/Redo, coalescing repeated edits
- src/core/rendering/canvas2d.ts — pure multi-layer renderer at explicit time

The v2 document contains id/title/duration/layers. Each layer has id, kind, title, strictly validated params, visible, opacity, hex color and bounded mathematical offsets. Layer IDs are required to be unique. Source schema validation does not evaluate arbitrary expressions.

## Migration
- Parse v2 if valid; otherwise try strictly validated legacy v1.
- Legacy layers retain title, kind, and every numeric parameter.
- Browser loader checks paramyra.document.v2 before paramyra.scene.v1; the old key is retained as a fallback.
- JSON import accepts v1 or v2 but writes the new v2 format; size capped to 256 KiB.
- Browser autosave writes only paramyra.document.v2.
- User presets are separate, bounded to 12 documents, and stored in paramyra.presets.v2.
- Never import files by eval/new Function or unvalidated executable expressions.

## Scene runtime
- SceneCanvas has one canvas RAF loop, independent from React state updates.
- Time is accumulated in real elapsed seconds, capped for inactive tabs. Scrubbing explicitly resets it via seekVersion.
- Parent time label updates at most around 10Hz; static galleries/paused canvases do not spin a permanent RAF.
- Canvas ResizeObserver maintains a DPR-bounded pixel buffer (max DPR=2).
- Camera pan/grid/axes/zoom/display style are ephemeral view state, not persisted document history.
- Layer order is draw order; the last layer renders on top.

## User-visible scope
Implemented: layers CRUD/order/visibility, style and numeric parameters, bounded history, timeline seek/play/pause/speed/duration, camera tools, custom local presets, v1 migration.

Not implemented in this release: time keyframes, bezier animation curves, arbitrary expression parsing, physical integrators, 3D, user accounts, server-side cloud persistence, collaborative editing, video export.

## Review gates
- Lint, strict TypeScript, unit tests (validation/history/renderer), Next build, desktop/mobile Playwright green on exact HEAD.
- Browser Preview on Vercel Ready; visually inspect at 1920×1080, 1365×768, 390×844.
- Exercise v1 import and v1 localStorage migration, Undo/Redo, add/delete and reorder layers, toggle visibility, pause/seek/zoom, preset persistence on reload.
- Keep PR draft until visual approval; stacked dependency is PR #6. Do not merge directly to main.
