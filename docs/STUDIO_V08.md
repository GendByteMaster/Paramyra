# Paramyra Studio v0.8 — Professional Canvas

**Change branch**: dev/studio-professional-canvas-v08  
**Stacked on**: dev/studio-document-v07 / PR #7  
**Status**: Draft; do not merge ahead of the dependency stack.

## Source-of-truth boundaries

- `src/core/rendering/geometry.ts`: pure mathematical world/screen projections, shared curve sampling, inverse coordinates, hit testing, world grid step, camera fitting and cursor-anchored zoom.
- `src/core/rendering/canvas2d.ts`: Canvas2D rasterizer. All layers and grid use the same world-space scale and camera transform. Document data is not mutated.
- `src/components/scene-canvas.tsx`: single RAF/ResizeObserver and pointer/keyboard interaction. Renderer remains framework independent.
- `src/components/studio-v07.tsx`: presentational layout, selection, tool state, document history and persistence; v2 schema remains unchanged.
- `src/core/document/schema.ts`: authoritative bounds on persistent layer offsets and validated JSON.

## Interaction rules

1. Select mode is default. Hit-test visible, nontransparent curve strokes from top to bottom; select the first hit.
2. Dragging a hit curve edits only that layer's `offset`; delta is translated from CSS pixels to math units and limited to the schema's [-2, 2] bounds. Existing bounded/coalesced history is preserved.
3. Drag empty space, choose Pan, hold Alt, or use middle-button dragging to pan the camera. Camera changes are transient and not part of document undo history.
4. Mouse-wheel zoom uses pointer anchoring. Zoom is bounded to 0.1–8×. Toolbar Reset Zoom returns to 100% without resetting document state.
5. Fit Scene samples every visible layer at the current deterministic timeline time, computes world bounds, centers them and chooses a fit zoom with 36 CSS-pixel margins (subject to zoom bounds). Hidden layers do not affect Fit.
6. Reset Layer resets the selected mathematical form's numeric parameters and offsets only. Other layers, color, visibility and opacity are preserved.
7. Reset Camera only resets zoom/pan. Mathematical document and display preferences remain unchanged.
8. Canvas focus enables arrow-key nudge of the selected layer, with Shift for larger movements. Native form controls retain their own keyboard behavior.

## Mathematical scale

- World positive X points right; positive Y points up.
- `baseRadius = 0.45 * min(cssWidth, cssHeight)` CSS pixels per unit at 100% zoom.
- Lissajous and polar-rose use their native normalized curve coordinates.
- Harmonic waves use a width-aware world-domain transform so their visible span matches the previous viewport behavior.
- The Cartesian grid is drawn at 1/2/5-decade world-unit steps, chosen to remain legible at the current zoom, and uses numeric axis ticks.

## Security and performance

- JSON v2 validation and import-size limits are unchanged; no arbitrary expression execution.
- No React/DOM dependencies in mathematical geometry.
- Curve selection is bounded to 640 polyline samples per visible layer, maximum 12 layers; topmost-hit priority is deterministic.
- Fit samples only on explicit user action, not every frame.
- Existing animation loop is paused when paused or hidden and honors reduced motion.
- Browser localStorage remains a convenience, not a durable backup. Use Export JSON.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm test` (new geometry invariants: world projection, cursor zoom, hidden-layer fit, hit testing, adaptive grid)
- `npm run build`
- `npm run test:e2e` (new direct manipulation/undo, independent reset and select/pan tool cases)
- Manually verify visual quality and interactions at 1920×1080, 1365×768 and 390×844.
- Manually check overlapping curves, axes with large pan, slow drags with Undo, touch handling, the 12-layer upper bound and custom templates.
- Verify Vercel Preview and CI on **the exact final commit SHA**.

## Deliberate exclusions

This v0.8 increment is Canvas2D only. It does not add arbitrary formulas, 3D, physics integrators, time keyframes, SVG/video output, multi-project IndexedDB, cloud sync, collaboration or a complete editor-controller refactor. These remain separate future milestones.
