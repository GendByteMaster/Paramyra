# Paramyra Studio v1.0 M3.0 — Independent Node Graph Workspace

**Head:** dev/studio-node-graph-m3  
**Stack base:** dev/studio-timeline-graph-sync-m25 / PR #18.  
**Merge:** Draft only until predecessor chain and exact-HEAD verification pass.

## Product

A dedicated workspace is available at **/studio/graph**, with a mode link in the Studio toolbar and site navigation. It has its own Node Library, draggable/wireable canvas, mini-map, zoom/fit, Graph Inspector, scene preview, import/export and undo/redo. It does **not** replace Animation Timeline, Graph/Bezier Editor, Playground or Studio.

Visual ergonomics are inspired by the user's **FlowForge** project (library/canvas/inspector, port affordances, color-coded node categories, compact desktop workspace). No FlowForge runtime code or workflow executor is copied. M3.0 uses native React/SVG and the existing dependencies. React Flow is a possible canvas adapter later, not a data model or computation engine.

### Supported math graph (M3.0)

- Input: Number, Time (playhead time, seconds).
- Operators: Add, Multiply, Sine (radians).
- Output: explicit whitelisted Studio property (opacity, x/y offset, stroke width, formula a/b/c).
- Click an output port, then a compatible input port to connect; reconnecting replaces that input atomically.
- Drag node headers; zoom/pan/fit graph; select nodes in the Inspector, edit constant/target and delete nodes/edges.
- Inline evaluated outputs and local scene preview at the selected playhead.
- Apply to Studio writes **static** numeric values to the selected layer, only on explicit user action.

### Authority and boundaries

- Graph topology is held in strict **NodeGraph v1** at \`paramyra.nodegraph.v1\`, with independent graph history. M3.0 does not add unknown fields to MathDocument v3.
- **MathDocument v3** at \`paramyra.document.v3\` remains the authoritative scene document. A pure \`projectGraph()\` returns a derived preview without modifying it. Apply re-reads Studio's latest stored document, validates all outputs and writes a fully valid document. Legacy v1/v2 document keys use Studio's existing migration precedence.
- Only known numeric ports/properties. Strict Zod parsing (IDs, finite numbers, node/edge size caps, no duplicate targets/ports, cycle rejection). Evaluation is bounded, deterministic and synchronous; no eval/JS execution/network.
- Apply is rejected for out-of-bounds values, formula properties on a non-formula layer, incomplete output paths and outputs targeting animated channels. No hidden keyframe mutations.
- No live runtime binding in M3.0: changing the graph or playhead doesn't write to the scene; clicking Apply commits a single sampled static value to the scene. Undo/redo in Graph Workspace affects graph topology, **not** committed Studio history.
- Separate-tab concurrent writes use browser localStorage (last writer wins). Collaborative editing, conflict resolution and durable graph-to-scene live connections are future work.

### Test and release gate

- [ ] Exact HEAD ESLint, TypeScript, Vitest and Next build
- [ ] Exact HEAD Playwright desktop/mobile coverage (route, projection, apply, cycle, undo, import rejection, overflow)
- [ ] Manual visual/keyboard/touch checks at 1640×930, 1365×768, 390×844
- [ ] Large-graph pan/zoom performance and keyboard/screen-reader inspection
- [ ] Predecessor PRs merged sequentially, final merged-head CI
- [ ] Vercel Preview valid on exact release SHA (subject to platform build-rate limits)

## Follow-up M3.1

Add supported automatic per-time graph-driven scene parameters with a **versioned domain schema and migration**, an authoritative evaluator projection integrated with animation sample order, an explicit conflict-resolution policy for keyframes, and performance checks. Optionally adopt React Flow for canvas interactions once dependency/build management is available; React Flow remains a UI adapter over typed graph domain actions.
