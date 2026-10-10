# Paramyra Studio v0.6 — viewport-first design specification

The desktop editor is a full-width application shell, distinct from the public gallery. It does not change the shared SceneDocument or introduce fake editing functionality.

## Visual dimensions
- Full-bleed outer workspace: viewport width minus 16px; no max-width cap
- Desktop >=1600px: 290px Library / flexible center / 380px Inspector
- Desktop 1280–1599px: 260px / flexible / 350px
- Desktop 960–1279px: 210px / flexible / 300px
- Panel gap 8px; outer margin 6–8px; canvas is the primary tool, not a page card
- Analysis panel compact (approx. 120–140px in Overview), with JSON view optionally scrollable
- Toolbar 62px minimum; Inspector and Library independently scrollable

## Fullscreen modes
1. **Full-bleed by default:** Studio fills browser viewport; public header/footer are absent.
2. **Real Fullscreen:** user-activated Fullscreen API on the workspace root. Escape/Exit returns to regular browser UI. Browser restrictions are surfaced as a status message.

Canvas resizes with the actual DOM bounds; no CSS scaling hacks.

## Rendering
- High-DPI bitmap scaling capped at devicePixelRatio=2
- Pixel-aligned grid, low-contrast axes, layered curve glow, adaptive finite sample count
- Consistent zoom scaling for all wave points (fixes discontinuous first segment)
- No evaluated untrusted expressions or new React updates per frame

## Acceptance
- No clipped actions at 1920×1080 or 1365×768
- Fullscreen can enter/exit and resizes canvas
- No horizontal overflow at 390px mobile viewport
- Math schema, importing, editing, rendering and persistence preserved
- Green lint/types/unit/build/Playwright on final exact commit
