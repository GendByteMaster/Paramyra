# Paramyra Studio v1.0 M2.5 — Timeline ↔ Graph Consistency & Keyboard Precision

**Branch:** `dev/studio-timeline-graph-sync-m25`
**Base:** `dev/studio-animation-ux-m24` (Draft PR #17).
**Integration:** stacked draft only; no direct merge into `dev/master` or `main`.

## Problem

M2.3 introduced timeline zoom/pan, but the graph continued plotting the full duration while the playhead used a viewport-relative coordinate. Users saw inconsistent time/value positions, and keyframes outside the timeline range remained plotted. Keyboard marker movement did not retain selection when a marker changed time, and the React remount lost focus. Optional snapping could absorb small precision nudges.

## Changes

- Graph polylines now sample exactly the active `TimelineWindow`; SVG keyframe markers use the same viewport mapping and are hidden outside its bounds.
- Graph playhead only renders when the actual playhead is inside the visible window.
- Keyboard arrows perform 0.01s edits; Shift+arrows perform 0.10s edits. Precision nudges bypass the optional pointer snapping grid.
- On a selected group, arrows invoke the existing atomic `moveKeyframes` operation (all-or-nothing collision/overflow protection).
- Delete/Backspace removes the selected group, or the focused marker if not part of a group.
- Selection tracks a moved keyframe by identity (property + rounded time). Focus follows the remounted marker after each successful keyboard move.
- New Playwright regression cases for viewport consistency, focus retention, and atomic multi-keyframe keyboard operations.
- No new dependencies, no document schema changes, no new persistence, and no second animation state.

## Architectural boundaries

`MathDocument v3` remains the sole persisted scene model; `sampleProperty` remains the interpolation authority. UI viewport/selection/focus are transient. React Flow is **not** appropriate as a replacement for a chronological timeline; reserve it for a subsequent M3 **Node Graph** that edits expression or parameter dependencies through an adapter to the authoritative document model.

## Acceptance before promotion

- [ ] ESLint / TypeScript / Vitest / Next.js build on exact head
- [ ] Full Playwright desktop + mobile run on exact head
- [ ] Verify keyboard repeat, Delete, drag and graph viewport under real touch/keyboard input
- [ ] Manual screenshots at 1640×930, 1365×768 and 390×844
- [ ] Confirm M2.4 PR #17 and all predecessors merged sequentially with merged-head CI
- [ ] Benchmark 12 layers × 72 keyframes for interactive graph/track responsiveness

### Follow-on M3 proposal (separate PR)

Prototype a scene-level node graph with React Flow and typed input/output ports, deterministic topological evaluation, cycle rejection, and undo/redo through document operations. Keep React Flow nodes/edges as a projection of scene domain data rather than a separate hidden source of truth. Do not combine graph runtime, keyframe timeline and dependency upgrades in the same release.
