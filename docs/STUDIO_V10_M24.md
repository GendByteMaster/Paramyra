# Paramyra Studio v1.0 M2.4 — Animation Workspace UX Overhaul

**Branch:** `dev/studio-animation-ux-m24`
**Base:** `dev/studio-professional-timeline-v103` (PR #16), itself stacked on #15 → #14 → #13 → #12 → #11.
**Delivery:** Draft PR; do not merge into `main` or `dev/master` without predecessor resolution.

## User problem

On a typical ~1650×930 desktop, the Canvas retained an implicit minimum height while the Animation dock requested its own height. Their combined minimums exceeded the fixed-height Studio shell, clipping the bottom of Timeline and Graph Editor. A large visual preview effectively displaced the actual editing controls.

## Changes

- Desktop Canvas / Timeline split: dock opens at approximately 47% of screen height, with the remaining available area assigned to the canvas. The viewport and canvas flex children are explicitly allowed to shrink. Exact split size is adjustable with the existing accessible separator; max height respects the center workspace's actual available height.
- The Animation panel owns its vertical scrolling instead of being cut off by the app shell. Timeline toolbar sticks to the top while scrolling, and keyframe tracks or All Layers overview have their own bounded scroll regions.
- **Editing first**: Property Tracks and Graph / Bezier inspector appear above optional numeric inputs, group actions, and helper text in the **DOM and keyboard tab order** (not CSS-only visual reordering).
- Controls have more readable labels (mostly 12–13px) and keyboard-friendly 36–39px hit targets. Existing Focus mode is retained and made prominent. It remains user-selectable rather than hiding the Inspector automatically: the new live/base Inspector comparison is most useful with both panels visible.
- Inspector has a *Base vs Playhead* comparison projected from the authoritative layer's numeric properties and pure sampler. It distinguishes the base stored value from the sampled animation at the current timestamp, marks keyed channels, and explains the role of the Inspector sliders. Seeking or toggling panels never modifies MathDocument.

## Architectural and performance rules

- Keep `MathDocument v3` and existing layer history. Do not copy resolved/animated values into document state; animation output remains read-only and deterministic.
- No additional npm dependencies, no React Flow in Timeline, no new engine, and no server or network calls.
- Native CSS containment and nested scroll owners prevent large sets of keyframes from growing the entire dock. Full virtualization is **not** claimed.
- Desktop app-like viewport rules apply from 960px width and 680px height; smaller viewports retain document flow scrolling and non-sticky toolbars.

## Acceptance checklist

- Exact HEAD lint, typecheck, Vitest and production build green.
- Playwright desktop (1640×930, 1365×768), mobile (390×844), sticky toolbar, scroll independence, Inspector live-vs-base and no-write-on-seek.
- Visual screenshots on target devices, physical touch interaction, screen reader/keyboard check, performance under 12 layers × 72 keyframes.
- Manual review and stacked predecessor merge before marking ready for production.

**Out of scope:** video export, automatic cross-layer edits, React Flow node graphs and large-scale track virtualization.
