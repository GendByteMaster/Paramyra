# Paramyra Studio v1.0 M2 — Advanced Animation, Increment 1

**Branch:** `dev/studio-animation-v10-m2`  
**Base:** `dev/studio-animation-v10` (M1 PR #12), itself stacked on v0.9.2 PR #11.  
**Status:** implementation and automated validation in progress; do not merge to `main` or `dev/master` before the predecessor stack is accepted.

## Implemented in M2.1

- Expanded explicit, strictly typed keyframe paths: `opacity`, `offset.x`, `offset.y`, `params.strokeWidth`, and formula-only `formula.a/b/c`.
- Multi-property track list for the selected layer; each property has its own accessible markers. The selected track retains the M1 value editor, five easing presets and Graph Editor.
- Move markers by pointer drag, keyboard arrows (Shift for 0.1s), or a numeric exact-time field; collision/out-of-duration moves do not overwrite frames. A drag commits one Undo/Redo operation at pointer release.
- Both Canvas2D and SVG/PNG export reuse `resolveAnimatedDocument`, which now animates formula parameters and stroke width as well as position/opacity. All interpolation remains deterministic and bounded.
- Optional `keyframes` on existing MathDocument v3 layers; no document version bump or migration. Invalid formula tracks on a non-formula layer are rejected during strict JSON import.
- Pure model validation and Playwright regression added.

## Validation and limitations

- The document still permits max 12 layers, max 72 keyframes per layer, duration 2–60s, bounded frame values and 0.01s keyframe move precision.
- Formula source strings are never interpolated or executed; only numeric parameters are animated through the existing AST evaluator.
- No server, network, new runtime dependency, arbitrary property-path lookup, script-capable SVG content or client-to-server uploads.
- Do not represent CI and preview as green until the exact final HEAD passes. Physical mobile touch, drag edge cases and sustained performance need independent acceptance.

## Next M2 increments (not implemented yet)

1. **M2.2:** interactive, strictly bounded cubic Bezier handles and multi-keyframe selection/edit operations.
2. **M2.3:** zoomable timeline, cross-layer track view, keyboard range selection and editing polish.
3. **M3:** optional video/animation export, performance profiling, mobile physical-device verification.

This is **M2.1 only**, not the entire M2 release.
