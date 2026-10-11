# Paramyra M4.1 — Project Integrity & Professional Workspace

## Goal and authoritative models

A Studio project is a single versioned snapshot with `scene: MathDocument v3`, `graph: NodeGraph v3`, and `coursework: CourseworkDraft v1`. The MathDocument contains animation duration and every keyframe. The transient playhead is session state and resets to t=0 on a project switch.

The project library schema is v2, using the pre-existing `paramyra.studio.projects.v1` storage key for in-place compatibility. Upgrades from v1 read historical `paramyra.graph.coursework.v1.<projectId>.<graphId>` keys, and only the oldest project may read an old unscoped draft. Legacy keys remain intact.

## Operations

- New project starts with validated scene, graph and an empty English Coursework form.
- Duplicate retains the source's exact Coursework and timeline snapshot, but subsequent report edits affect only the duplicate.
- Switch changes the scene, graph, authored keyframes and selected report together; playhead resets.
- Full Project Export uses strict `paramyra-project` v2 with scene, graph and Coursework. v1 project bundles import with default blank Coursework.
- Import validates the *whole* bundle before replacing the active project snapshot. Unknown keys and invalid values are rejected.
- Coursework editing persists to the active project's authoritative registry; the old per-graph key is migration-only.
- Project Library shows the scene, graph, keyframe count and Coursework ownership; the dialog supports cycling keyboard focus.

## Persistence limitations

`localStorage` writes are not transactional between tabs, so this release does not promise multi-tab CAS/CRDT, IndexedDB durability or cloud backup. The registry write remains the authoritative commit; legacy mirrors support old editor integrations and are restored on synchronous failures where possible. On parse failure, the invalid registry is preserved rather than overwritten with a blank fallback. Users should export JSON before clearing browser data.

## Verification commands

```bash
npm ci --no-audit --no-fund
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Regression requirements: v1 registry migration; scoped and unscoped Coursework migration without rewriting custom text; project duplication/edit isolation; undo/history and keyframes preservation; bundle v2 round trip and strict v1 import; quota rollback and malformed registry protection; Graph ↔ Studio switching; desktop and compact-view Coursework/Library workflows. CI must pass at exact branch HEAD before review/merge. Manual print-to-PDF and touch-device acceptance remain separate gates.
