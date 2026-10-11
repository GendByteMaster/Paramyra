# Paramyra architecture — Studio M4.1

## Boundaries

- Next.js App Router: routes, shell, and UI. React Flow renders graph layout, but the typed DAG model and math evaluation remain independent of it.
- MathDocument v3: authoritative scene, layer geometry, formulas, animation duration and authored keyframes. Playback time is per-tab session state, not a persistent project edit.
- NodeGraph v3: typed, validated and bounded DAG. Live output resolves against the same MathDocument with keyframe precedence and bounded ranges.
- StudioLibrary v2: authoritative browser-local registry of up to 20 independently named projects. Each snapshot stores MathDocument, NodeGraph and validated CourseworkDraft. The storage key remains `paramyra.studio.projects.v1` to migrate existing data without deleting it.
- Legacy mirrors `paramyra.document.v3` and `paramyra.nodegraph.v3` support existing consumers, but are not separate projects.
- JSON portable bundle v2: one scene, one graph and one coursework draft. Import of v1 bundles creates a default empty English report. Exact schemas reject unknown fields, malformed math and invalid report data.
- Migration: valid library v1 records are promoted to v2, copying graph-scoped coursework (first project alone may accept the old unscoped draft). Original keys are not deleted or rewritten.
- Playground v2: isolated per-tab experiments with explicit non-destructive handoff to a new Studio project.

## Reliability and security

- Browser localStorage is synchronous, quota-bound and **not ACID**. Multi-key writes use best-effort rollback; different tabs may still race (last writer wins).
- Unsupported or invalid project registries are never silently overwritten by automatic fallback persistence.
- Scene, graph, expression and Coursework JSON are validated before mutation. User-authored formulas run through a bounded AST evaluator: no `eval`, `new Function`, imports or script execution.
- Do not treat localStorage as permanent backup. Export project JSON regularly. IndexedDB and multi-tab CAS/revision protocols are separate future milestones.
- Keep rendering and graph compilation outside per-frame React state. Test long animations, malformed inputs and desktop/mobile keyboard interactions.

See [M4.1 specification](STUDIO_PROJECT_INTEGRITY_M41.md) and [M4 project library](STUDIO_PROJECT_LIBRARY_M4.md).

## M4.2 recovery checkpoint foundation

IndexedDB stores an explicit validated full-library recovery checkpoint with transactional revision compare-and-swap. This is separate from the active localStorage editor registry: normal autosave remains synchronous and is **not** transactionally isolated between tabs. The new expected-active-project guards prevent stale editor writes from targeting a different project after cross-tab selection. The readwrite IDB transaction is atomic only for the checkpoint key. See [M4.2 recovery design](STUDIO_RECOVERY_M42.md).
