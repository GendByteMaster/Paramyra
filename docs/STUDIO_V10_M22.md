# Paramyra v1.0 M2.2 — Bezier Curve Editor & Multi-Keyframe Selection

**Branch:** `dev/studio-bezier-multiselect-v102`
**Parent:** `dev/studio-animation-workspace-ux` (PR #14); ancestors: M2.1 PR #13, M1 PR #12, Calculator Pro PR #11.
**Release state:** Draft / stacked, no changes to main or dev/master.

## User-facing features

- New per-segment **Bezier** easing mode with an interactive curve, two draggable handles, keyboard arrow controls and precise numeric inputs for x1/y1/x2/y2. Reset restores the default smooth cubic.
- Existing five easing presets remain unchanged; old documents still parse and render identically.
- Ctrl/Cmd-click toggles individual keyframes; Shift-click selects a range in one property track. Select Track / Clear controls, selected count.
- Atomic multi-frame time shift (+/- seconds) and group delete; single marker mouse/keyboard movements are preserved. Editing goes through the existing document Undo/Redo.
- Multi-selection state is **UI-only**, not written into MathDocument. Bezier handles are saved on the starting keyframe only and survive JSON import/export, local persistence and duplication.

## Model and safeguards

- `MathDocument schemaVersion:3` remains stable, with an optional strict `bezier: { x1, y1, x2, y2 }` only when `ease:"bezier"`.
- Each control point coordinate is finite and bounded to [0,1]. The curve is evaluated by 28 fixed-iteration bisection steps against x, then y is sampled. Endpoints are exact; monotone [0,1] handles avoid overshoot and keep property samples within their validated numeric range.
- No arbitrary property lookup, executable expressions, `eval`, script-backed SVG, external services or new dependencies.
- Group translation prevalidates every selected keyframe, timestamp, document-duration bound and collision; invalid moves are rejected **as a unit**. Time precision stays at 0.01s; 12-layer / 72-keyframe caps are unchanged.
- Bezier pointer moves update the preview only; a single history entry is committed on pointer release. Numeric inputs commit on blur.

## Verification and release gates

- Exact HEAD lint, strict TypeScript, Vitest, production build, Playwright desktop/mobile and Vercel Preview.
- Dedicated tests for interpolation, malformed JSON, collisions, Undo/Redo and mobile editing.
- Manual visual/touch acceptance at 1365×768 and 390×844, physical dragging, larger keyframe scenes and performance remain release gates.
- Keep Draft until predecessors are merged in sequence and exact merged HEAD is validated.

**Not included:** React Flow-based node graphs (not a fit for timeline editing), unrestricted Bezier overshoot, cross-layer multi-selection or video export.
