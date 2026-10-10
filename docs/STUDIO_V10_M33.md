# Paramyra Studio v1.0 — M3.3 Professional Node Graph Workspace

**Stack:** M3.3 \`dev/studio-graph-workspace-m33\` → M3.2 PR #21 → M3.1 PR #20 → M3.0 PR #19 → M2.5 PR #18. This is a **stacked Draft**, not a direct release to \`dev/master\`.

## Full Graph Workspace

\`/studio/graph\` has an independent project toolbar, a graph command bar, node library, React Flow canvas, Inspector, preview, Live Graph status, minimap, and browser fullscreen mode. On narrow screens command controls scroll horizontally while the canvas and Inspector stack.

### Editing

- **Multiselection**: marquee drag with left mouse; Shift/Control/Meta-click additional nodes, with Space+drag to pan. Select All also works from the toolbar or Ctrl/⌘ A.
- **Copy** (Ctrl/⌘ C): selected nodes, edges only when both endpoints are selected, and fully-contained group membership. Copies to in-app clipboard and, where authorized, system clipboard as validated JSON.
- **Paste** (Ctrl/⌘ V): duplicates the selection with fresh IDs and a viewport offset. Preserves internal links and group memberships. Output nodes are assigned unused target properties when the original property is already occupied; if no valid targets remain, the entire paste is rejected.
- **Delete**: drops selected nodes and attached connections with one history entry; leaves at least one node. Deleting a selected group only removes the group container and **preserves its nodes**.
- **Group** (Ctrl/⌘ G): persistently groups at least two ungrouped nodes. Group containers are visual React Flow nodes, not executable DAG nodes. Dragging the group's header shifts member nodes together in one transaction. **Ungroup** (Ctrl/⌘ Shift G) removes grouping without removing nodes.
- Undo/Redo includes add/edit/connect/paste/group/ungroup/delete and batch moves. Selection, canvas zoom and fullscreen are transient UI state.

## NodeGraph schema and authority

NodeGraph **v3** introduces \`groups: { id, title, nodeIds[] }[]\`. The Graph document stays authoritative for topology, positions, ports and groups; React Flow is only an adapter. Group IDs and memberships are unique, non-overlapping, reference live nodes, and require at least two members. Max 16 groups, 32 executable nodes, 64 edges. Persistence uses \`paramyra.nodegraph.v3\`; strict v1/v2 migrations preserve previous graphs with empty groups. Invalid v3 payloads fail closed. M3.1 Live Binding and **keyframes-win** precedence are unchanged.

## Portable project file

**Export Project** writes a single JSON file with the exact shape:

\`\`\`json
{
  "format": "paramyra-project",
  "version": 1,
  "scene": { "schemaVersion": 3 },
  "graph": { "schemaVersion": 3 }
}
\`\`\`

Actual exported \`scene\` and \`graph\` contain the full validated documents, including layers, formulas, keyframes, groups, edges and Live Binding.

**Import Project** validates both documents and the graph's enabled layer reference *before* persistence, with a 512 KB file limit. Import replaces the local scene and graph and resets Graph undo history. Invalid JSON, corrupt DAG, missing live target or incompatible live output is rejected without changing either document. localStorage has no multi-key transaction; import uses best-effort rollback if a synchronous storage write fails, but concurrent edits in multiple browser tabs remain **last writer wins**. Do not claim atomicity across tabs.

The legacy **Import/Export** buttons still operate on Graph-only JSON. Studio's existing export remains Scene-only JSON. The new Project file is the recommended portable way to preserve live visualizations.

## Release gates

- [ ] Exact HEAD npm ci, ESLint, TypeScript, Vitest, Next build and Playwright desktop/mobile
- [ ] Visual/manual QA at 1640×930, 1365×768 and 390×844; keyboard, screen reader, touch gestures
- [ ] 32-node/64-edge and 12-layer/72-keyframe performance checks on slow hardware
- [ ] Import/export bundle round-trip under real browsers and storage quota failure
- [ ] Vercel Preview from exact SHA (prior builds are affected by Hobby build-rate-limit)
- [ ] Sequential merges of prerequisite Draft PRs, final merged-head CI

Do not mark ready or merge until all release gates are verified.
