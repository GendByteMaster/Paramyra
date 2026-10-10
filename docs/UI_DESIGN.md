# Paramyra UI v0.2 — FlowForge-quality visual direction

Reference: Private GendByteMaster/FlowForge (Dev), inspected October 2026; no source was copied.

## What is adapted

- A cohesive material language: nested dark surfaces, highlighted borders, restrained blue/cyan accents
- Distinct hero/studio compositions with gradients, product context and layered depth
- Editor hierarchy: contextual toolbar, live canvas, transport, mathematical inspector and scene shortcuts
- Rich gallery hierarchy with metadata, equations and clear scene actions
- Reduced-motion defaults and responsive mobile fallbacks

## What remains Paramyra-specific

- Original mathematical visualizations, SceneDocument, render loop and parameter controls
- Scene-driven visual metaphor, indigo/cyan palette and parametric preview
- No FlowForge state store, node editor, splash screen or cursor tracking copied

## Accessibility and performance

- Native controls and semantic navigation preserved, with focus-visible outlines and skip link
- CSS transitions only for surfaces; no added per-frame React state
- Canvas remains independent from UI animations
- Mobile breakpoint shows stacked tool panels; E2E test verifies lack of horizontal overflow
- The UI says "local project", not "cloud saved"

## Review gate

Run npm ci, lint, typecheck, unit tests, build and desktop/mobile browser E2E. Capture live screenshots and review narrow/wide viewport spacing, focus and reduced-motion manually before merging.
