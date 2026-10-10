# Paramyra Studio v1.0 — Animation Workspace UI/UX

**Base:** `dev/studio-animation-v10-m2` (PR #13), which is stacked on PR #12 and Calculator Pro PR #11.

## Why this iteration

At desktop resolutions including 1365 × 768 and ~1600 × 900, the existing animation surface was constrained by an inherited 245px Scene Details max-height, causing the timeline/graph controls to be hidden behind scrolling at the bottom of the canvas. On mobile, an unwrapped project toolbar could place controls outside the viewport.

## Changes

- A discoverable **Open animation workspace** control next to the Canvas toolbar controls.
- In Animation mode, the center column allocates a separate, visibly resizable editor dock instead of limiting Scene Details to 245px.
- Resizer is mouse/touch/pointer accessible, uses pointer capture, and supports Arrow Up/Down plus Home/End.
- **Focus** mode temporarily hides Scene Library/Inspector to give the editor full width; exiting restores them without modifying their open/closed preferences.
- Redesigned editor hierarchy: property/value/easing controls, separate Property Tracks and Graph Inspector, deterministic Graph Editor intact.
- Click empty track to seek to a time; clicking/moving diamonds retains existing keyframe behavior and Undo history.
- Mobile project toolbar wraps rather than sending Undo and other actions outside the viewport. Dock remains naturally flowing/scrollable on small devices.
- Dedicated desktop + mobile Playwright regressions.

## Architectural choice

React Flow is intentionally **not** introduced into the animation timeline. It is a node/edge graph library, not a timeline or Bezier curve editor, and would add bundle weight and a second interaction model to a sensitive workspace. Reserve React Flow for a future opt-in **Node Graph** projection over the same underlying MathDocument/runtime. Do not duplicate authoritativeness or add arbitrary JavaScript execution.

## Release gate

- Exact HEAD lint, typecheck, Vitest, build, E2E, plus preview.
- Review 1365 × 768, 1600 × 900, 390 × 844 and physical touch, and assess performance.
- PR #13 had 17 earlier E2E failures (mostly mobile timeouts); this iteration attempts to address a toolbar overflow cause but should not be called green without new exact-head CI.
- Parent PRs must merge in stack order; do not promote to `main` prematurely.
