# Paramyra Studio v1.0 — M3.1 Live Node Graph Integration

Stacked branch: \`dev/studio-live-node-graph-m31\`. Base PR #19 (M3.0). Keep Draft, no merge until exact-HEAD validation and predecessor gates pass.

## Live mode

The independent \`/studio/graph\` workspace now has **Enable Live Graph**, a selected target layer, and a visibly documented **keyframes-win** conflict policy. The graph is evaluated at the same clock/playhead as Studio's \`SceneCanvas\`, including pause, seek, loop and speed changes. Graph edits auto-persist and update Studio in another browser tab through \`storage\` events. Studio's output is not written back into base properties during playback.

### Deterministic precedence

1. Read authoritative \`MathDocument v3\` base layer properties.
2. Interpolate all Timeline keyframe tracks for the current playhead.
3. Evaluate the validated graph on its compiled acyclic topology.
4. Apply graph outputs to **unkeyed** properties of its explicitly bound layer only.
5. If the target layer is missing, any graph path is incomplete, a formula-only property points at an incompatible layer or an active numeric output is invalid: fail **atomically** to the normal interpolated scene; report a status error.

Any keyframed track is authoritative **at all playhead times**, not only between keyframes. Deleting the keyframes makes that property graph-drivable again. Graph exports are not embedded into the Studio JSON: Graph v2 and MathDocument v3 remain independent versioned domain data; the user must export both files for a fully portable live project. There is no invisible two-way synchronization, arbitrary JavaScript or \`eval\`.

### Versioning and safety

- Graph schema upgrades **v1 → v2**: stored key \`paramyra.nodegraph.v2\` with \`binding:{enabled,layerId,priority:"keyframes-win"}\`. Existing v1 JSON and localStorage migrate strictly to v2 with **Live disabled**; corrupt v2 fails closed.
- Validation still uses typed whitelisted nodes and ports, bounded sizes and cycle rejection. Compiled graph maps are derived only once per graph change and are transient. They are not additional persisted source-of-truth.
- Static **Apply to Studio** is disabled while Live is on. Turning Live off restores the M3.0 static snapshot workflow.
- Canvas drawing, geometric hit testing, camera fit, PNG and SVG exports share the exact same scene projection function, preventing preview/export mismatches. Timeline base values remain immutable.
- Studio listens for cross-tab changes to the saved graph and document. This is localStorage coordination, **not** a multi-user transaction protocol; concurrent edits in multiple tabs are last-writer-wins.

## Verification and release gates

- [ ] ESLint, TypeScript, Vitest, Next.js production build on final SHA
- [ ] Playwright desktop + mobile and cross-tab persistence (live, reload, keyframe priority, disabled, invalid graph)
- [ ] Manual QA: keyboard and touch editing, 1640×930 / 1365×768 / 390×844
- [ ] Frame-time budget: 12 layers / 72 keyframes, 32 nodes / 64 edges, slow devices
- [ ] Full predecessor chain merged sequentially, checks on the merged HEAD
- [ ] Vercel Preview of **final SHA** (older builds and \`build-rate-limit\` do not prove release readiness)

## Follow-on

M3.2: portable project bundle containing both graph and scene documents, reversible integration transaction semantics, conflict handling for multi-tab edits, graph runtime introspection and per-node diagnostics; optional React Flow presentation adapter once bundle/performance decisions are measured.
