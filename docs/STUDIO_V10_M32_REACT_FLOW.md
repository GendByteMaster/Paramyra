# Paramyra Studio M3.2 — React Flow Workspace & Inspector Refresh

**Base:** M3.1 \`dev/studio-live-node-graph-m31\` / Draft PR #20.  
**Branch:** \`dev/studio-react-flow-m32\`.  
**Release:** stacked Draft until every predecessor and exact final HEAD gate passes.

## Goal

Replace M3's hand-built node canvas with **React Flow 12** (\`@xyflow/react@12.12.0\`) while keeping all computations, persistence, versioning, and keyframe conflict behavior in the existing typed NodeGraph v2 domain.

## Architecture and features

- \`GraphReactFlowCanvas\` is a **presentation adapter**: \`NodeGraph v2.nodes/edges\` projects to React Flow \`Node/Edge\`. React Flow owns viewport, mouse/touch gestures, minimap, handles and zoom. The existing immutable graph is the sole persisted graph source of truth.
- React Flow gestures write back through \`connectGraph\`, \`updateGraphNode\`, and \`disconnectGraph\`; connections are strictly validated by the existing acyclic typed-port domain, not accepted just because XYFlow allows a line.
- Real handles support pointer-based source→target wiring and rewire single input ports transactionally. Existing click source/click target remains accessible as a keyboard-friendly alternative.
- Node dragging commits only at pointer release to avoid one graph-history entry per pixel. A connection remains a single Undo/Redo operation.
- M3.1 Live Graph, \`keyframes-win\`, layer binding, previews and Studio PNG/SVG/export pipeline are **unchanged** by the adapter.
- A more spacious Inspector (338–364px on desktop) surfaces Live status and target controls early; controls have readable typography and focus states. At tablet/mobile widths, the canvas stacks before Inspector/Library instead of crushing panels into thin columns.
- React Flow CSS is loaded globally, followed by Paramyra overrides. Dependency versions are pinned in \`package.json\` and reproducibly resolved in \`package-lock.json\` for \`npm ci\` / Vercel.
- Graph topology, edge IDs, and numeric node values are still serialized only in \`NodeGraph v2\`. No duplicated \`ReactFlow.toObject()\` storage, foreign graph state, or executable expression strings.

## Tests

- Existing M3/M3.1 tests for source-click wiring, keyframe priority, import rejection, cross-tab sync and Studio static Apply continue.
- New Playwright verification: React Flow viewport/handles, pointer connection rewiring, stable node/edge count and small-screen Inspector visibility/overflow.
- Manual gates: keyboard focus and screen reader labels, touch pinch/pan/drag, 390×844 / 1365×768 / 1640×930, 32-node performance, long titles, reduced motion, Vercel Preview deployment from exact SHA.

**No merge** until production-style build, automated tests and manual release gates pass. Do not redeploy a stale commit or use green CI from M3.1 as proof for M3.2.
