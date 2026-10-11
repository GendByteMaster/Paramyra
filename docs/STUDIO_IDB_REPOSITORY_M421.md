# Paramyra M4.2.1 — Transactional Project Repository (Preview)

## Purpose

Create and verify the **candidate authoritative IndexedDB repository** before converting the live Studio and Node Graph write paths. This is a stacked increment after M4.2 checkpoints and M4.1 project integrity.

## Storage layout

- IndexedDB database: `paramyra-studio-checkpoints` (reuses the database and object store upgraded by M4.2).
- Object store: `snapshots`.
- Recovery checkpoint key: `studio-library`, unchanged.
- Candidate live library key: `studio-library-live` — distinct from recovery.
- Record: `{key,version:1,revision>=1,updatedAt,library:StudioLibraryV2}`.

## Transactions and migration

- `readLiveProjectLibrary()` strictly validates stored data and refuses unsupported future formats.
- `initializeLiveProjectLibrary(localStorage)` validates any existing legacy registry; migrates v1 Coursework through the shared library parser; initializes exactly once using a readwrite transaction that prevents a second tab from overwriting the first imported snapshot.
- If a candidate IDB record already exists, it remains accessible even when the legacy browser registry has later become corrupt.
- `mutateLiveProjectLibrary(expectedRevision,expectedActiveId,fn)` reads current state, compares **both** revision and active project identity, calls a synchronous pure update, strictly validates the full resulting project and persists inside the **same IDB readwrite transaction**. It rejects conflicts and malformed updates rather than silently merging or overwriting.
- `saveLiveScene`, `saveLiveGraph`, `saveLiveCoursework` provide domain-oriented wrappers. Keyframe tracks are embedded in the scene.
- The Project Library expandable diagnostics can *initialize snapshot* or *commit local snapshot*, and displays revision conflicts. These are explicit preview operations, NOT normal autosave.

## Safety boundaries

- **Current editor authority remains localStorage.** No component asynchronously hydrates from candidate IDB state yet; nor are undo/redo, Gallery import, Playground handoff or Library CRUD wired to these transactions.
- No old keys are deleted. No background promotion or automatic IDB-to-localStorage sync is attempted.
- Same-project conflicts in regular editor autosave remain last-write-wins.
- Even a transactionally committed IndexedDB record can be evicted by the browser; user-exported JSON remains the portable backup.
- A candidate snapshot may fall behind ongoing legacy editor edits. Never restore it automatically without user choice and conflict resolution.
- No JavaScript expression execution: input remains under strict MathDocument, NodeGraph and Coursework validators.

## Acceptance and next steps

1. Verify real cross-tab IDB initialization and revision conflict with Playwright.
2. Test bad legacy registries, corrupt IDB records, readwrite aborts, schema limits and failed mutations.
3. Add shared async hydration before both Studio and Graph components mount, gated behind explicit migration choice.
4. Route scene/graph/timeline/coursework edits and all project CRUD/import operations through the repository with revision ownership and a visible conflict-reload/export UX.
5. After compatibility UAT, remove legacy mirror authority, retain read-only migration path, and rerun the complete desktop/mobile suite on exact HEAD.

The current milestone is **repository foundation only**. Do not describe it as a complete M4.2 rollout.
