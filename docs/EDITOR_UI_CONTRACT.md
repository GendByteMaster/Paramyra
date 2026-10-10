# Studio / Node Graph — shared editor UI contract

The standalone Studio (`/studio`) and React Flow Node Graph (`/studio/graph`) are two editing modes, **not separate website pages**. They share the same application chrome and responsive geometry.

## Source of truth

- `src/app/editor-design-system.css` is imported **after** the Studio and Graph styles in `src/app/layout.tsx`.
- Both TSX editors use shared `pm-editor-*` primitive classes, while preserving their own `pm-*` and `pm-ng-*` domain-specific styles.
- Tokens define the external shell margin, pane gaps, left/right column widths, card radii, borders, titlebar heights, and scroll ownership.
- React Flow controls the graph viewport and nodes; the Graph domain model remains authoritative. Animation workspaces retain their timeline and selection behavior.

## Layout invariants

| Dimension | Studio | Node Graph |
| --- | --- | --- |
| Top-level public navigation/footer | Hidden | Hidden |
| Application shell | `pm-editor-shell` | `pm-editor-shell` |
| Project toolbar | `pm-editor-topbar` | `pm-editor-topbar` |
| Three pane grid | `pm-editor-pane-layout` | `pm-editor-pane-layout` |
| Library / Inspector | `pm-editor-panel` | `pm-editor-panel` |
| Preview titlebar | `pm-editor-viewport-heading` | `pm-editor-viewport-heading` |
| Panel scroll ownership | `pm-editor-content-scroll` | `pm-editor-content-scroll` |

For desktop widths at least 960 px and heights at least 680 px, both editors fit in a single `100dvh` surface. The **browser page does not scroll**; sidebars scroll independently. Sidebar widths are exactly the same at every breakpoint (210/300 at 960–1279 px; 260/350 at 1280–1599 px; 290/380 above 1600 px). Hiding either side panel retains the same track definition in both editors.

Below those viewport limits, both editors permit **document scrolling** to avoid cutting off controls. The Node Graph canvas retains a bounded height and React Flow gestures, while Studio retains its existing mobile drawer. Fullscreen modes remain explicitly viewport-bound.

## Regression checks

- `tests/e2e/editor-design-system.spec.ts`: compares the computed geometry and scroll policy of both routes.
- `tests/e2e/graph-workspace-m33.spec.ts`: verifies Graph canvas, editor toolbar, playhead, fullscreen and grouping.
- Run `npm run typecheck && npm run lint && npm run test && npm run test:e2e` before merging.
- A passing static test is not a substitute for visually comparing both editors at 1440 × 900, 1000 × 800 and 800 × 600.

Do not add new isolated root shell dimensions in `node-graph-shell.css`, `studio-shell.css`, or `studio-fullscreen.css`. New shared geometry belongs in `editor-design-system.css`; feature-specific styling remains scoped to its editor.
