# Paramyra v1.0 — Animation Studio, Milestone 1

**Source:** dev/studio-animation-v10, stacked on dev/studio-calculator-pro-v092 (PR #11).  
**Target:** PR into the parent feature branch; only retarget to dev/master when PR #11 has landed. main is untouched.

## Functional scope

- Per-layer numeric keyframes for **Opacity, Position X and Position Y**, 0–72 per layer.
- Existing schemaVersion 3 remains backwards-compatible: \`keyframes\` is an optional property on a MathLayer. Existing v1, v2 and v3 import/migration, localStorage and JSON export remain supported.
- Five interpolation types: linear, ease-in, ease-out, ease-in-out and hold. A keyframe owns the easing of the segment **following** it.
- Deterministic sampling from the common Canvas2D rendering pipeline; interpolation is pure and bounded. Scene point selection uses the same animated geometry. Fit to content uses sampled positions.
- Animation Timeline appears as a tab in Scene Details. Select an animated property, seek the playhead, add/update/delete a keyframe, choose easing, adjust its exact value or jump to an existing keyframe. Graph Editor plots the property’s interpolation over the document’s current duration.
- Editing an animated position by Canvas dragging is intentionally blocked to avoid silently overwriting the base layer offset; use the Animation tab to edit it.
- Keyframe edits use the existing document history so Undo/Redo, presets, JSON import/export and duplication keep their normal behavior.
- Frame export from the toolbar: PNG via the authoritative Canvas2D renderer, SVG via deterministic vector paths. Resolutions 1280×720 and 1920×1080; dark or transparent background. Exports use the **current playhead** and viewport camera. File generation happens locally, no upload.
- SVG is self-contained without scripts, external images, arbitrary HTML, external styles, untrusted elements or dynamic evaluation.

## Validation and security

- Explicit \`property\` enum; no property-path execution. Every keyframe’s time must fit scene duration and properties have strict per-field numeric ranges.
- Array size cap: 72/layer, with document layer cap still 12. Duplicate property/time entries and invalid easing/data fail strict Zod import validation.
- Export dimensions are integers, bounded between 320×240 and 2400×1600, with a maximum 3,840,000 pixels.
- Mathematical AST remains bounded as in v0.9.2. No new runtime dependencies, web services, camera access, unsafe inline HTML or eval.
- Accessibility: keyboard-focusable keyframe markers, labeled numeric/easing controls, transport integration and responsive design.

## Acceptance gates

- ESLint, strict TypeScript, Vitest, Next.js production build, Chromium desktop/mobile E2E, Vercel Preview at exact final HEAD.
- Verify interpolation and clamping, duplicate/malformed JSON rejection, Undo/Redo/persistence, renderer parity, XML escaping and real SVG/PNG downloads.
- No physical-device manual testing required to complete automated development gate, but do not claim it occurred.

## Staged v1.0 roadmap

- **M1 (this PR)**: keyframes + 3 numeric layer properties, easing Graph Editor, PNG/SVG frame export.
- **M2 (future)**: richer per-formula and per-style tracks, advanced multi-track editing, interactive curve handles and keyframe drag.
- **M3 (future)**: optional rendered animation/video export, capture/performance benchmarking and broader mobile UI optimization.

Limitations: exported SVG is a clean vector-curve representation rather than an identical raster reproduction of grid, gradient and glow; use PNG for WYSIWYG. Image exports are of a single frame, not animation/video.
