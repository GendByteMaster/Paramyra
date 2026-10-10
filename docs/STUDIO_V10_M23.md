# Paramyra v1.0 M2.3 — Professional Timeline

**Branch:** `dev/studio-professional-timeline-v103`
**Base:** `dev/studio-bezier-multiselect-v102` (PR #15), stacked on PRs #14 → #13 → #12 → #11.
**Merge policy:** Draft PR until exact final HEAD CI and manual UX acceptance; never directly mutate `main` or `dev/master`.

## Features

- **Zoom / pan / fit** (1×, 2×, 4×, 8×) with viewport centered around the current playhead. Visible ruler, seek targets and keyframe markers use the same transformed timeline window. Controls cannot pan beyond the document duration.
- **Grid snapping**: Off, 0.1s, 0.25s, 0.5s or 1s; active only when explicitly selected. Nearby unselected keyframes within 9px take priority over grid targets. New keyframes, keyframe moves and grouped shifts use snapping; conflict/overrun is still rejected atomically.
- **Box selection** across property tracks in the active layer by dragging empty track space. Works in either horizontal/vertical drag direction and uses time-domain and row-domain hit testing; Shift/Ctrl expands existing selection.
- **All Layers overview** shows every MathDocument layer, its animated properties and keyframes. Clicking a marker chooses that layer and seeks to the marker's timestamp. Editing remains scoped to the active layer: no cross-layer transaction is claimed.
- **Responsive UI** with viewport controls, selection rectangle, grouped property tracks and screen-reader labels.

## Architecture and constraints

- No new dependencies (React Flow is for the future Node Graph, not a timeline). No document schema changes; viewport/selection/snap state is transient.
- The existing safe formula AST, Bezier sampler, renderer, strict import validation, one-step Undo/Redo for bulk edits, limit of 12 layers/72 keyframes per layer and time bound 0..duration remain authoritative.
- Pure helpers in `core/animation/timeline-view.ts` handle time mapping, snapping, pan/zoom bounds and marquee selection independently from React/DOM.
- All Layers is a **projection** over `MathDocument`, not another data model. Marker selection moves between layers without modifying persistent project content.

## Acceptance

- Exact-head ESLint, TypeScript, Vitest, Next build, Playwright desktop/mobile and Vercel Preview.
- Manually validate at 390×844, 1365×768 and 1600×900, including precision dragging, scrolled panels and touch input.
- Stress test high key counts and all-layer rendering on actual hardware.
- Preserve predecessor branch history and merge stacked PRs in dependency order.

**Out of scope:** cross-layer grouped edits, unrestricted/freeform Bezier overshoot, video export, React Flow node graphs and keyframe waveform virtualization.
