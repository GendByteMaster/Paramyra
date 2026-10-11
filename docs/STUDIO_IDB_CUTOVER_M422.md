# Paramyra M4.2.2 — Transactional IndexedDB Editor Cutover

## Scope

This stacked milestone turns the preview `studio-library-live` IndexedDB record into the **authoritative full-project store after explicit activation**. No change to `main`; M4.2.2 builds on M4.2.1, M4.2 checkpoint and M4.1 migrations.

## Activation and safe startup

- Existing users start in legacy mode. Project Library → Transactional IndexedDB project storage → **Enable transactional autosave** explicitly confirms the migration. We do not auto-promote a possibly stale experimental preview snapshot.
- Activation takes the latest validated complete local Project Library, including scene, authored keyframes, graph and Coursework. If a candidate IDB preview exists, it is replaced only through an explicit, revisioned CAS write; a conflict rejects activation.
- The mode marker is set **only after** a successful IndexedDB commit.
- On later navigation or refresh, `DurableWorkspaceGate` awaits IndexedDB hydration before mounting Studio/Graph or running legacy autosave effects.
- Invalid, unavailable, or future IDB data blocks mounting instead of falling back to a potentially stale local cache. The recovery screen offers retry, export of a *valid* last local compatibility copy and an explicit choice to use that copy without destroying IndexedDB.
- Successful IndexedDB writes project the validated library to old localStorage keys as a compatibility cache. Failed compatibility writes trigger visible warning; IDB remains authoritative.

## Live editing and multi-tab conflicts

- `queueDurableMutation` serializes commits within the tab and requires the **exact revision and active project ID** in the IDB `readwrite` transaction. Later writers receive the latest successful revision.
- Scene editing, authored Timeline keyframes, Undo/Redo, Formula editing, graph edits, graph static Apply, Coursework edits, project creation/switch/rename/duplicate/delete, Playground handoff, scene/graph/bundle import and checkpoint restore all route via the same transaction API once mode is active.
- Distinct project edits and same-project edits by other tabs are not silently merged. A stale tab is blocked after a CAS conflict; its in-memory unsaved changes remain visible with an explicit notice to export JSON before reloading.
- All records continue to use the existing validated document/graph/Coursework schemas. No arbitrary imported code execution.
- The existing `studio-library-live` record is **never** overwritten after invalid/future data is encountered.

## Boundaries / non-goals

- **Opt-in**: the cutover is not forced on existing sessions until the user explicitly enables it.
- IndexedDB transactions are atomic for the live snapshot key; updating localStorage compatibility mirrors is *not* part of that atomic transaction, nor are cross-tab editors collaboratively synchronized.
- Browser quota, storage eviction, private browsing, killed tabs, failure during unload, Firefox/Safari, recovery usability and manual screen-reader/touch tests remain production release gates.
- Shared mathematical engine and React Flow runtime are unchanged; the backend/cloud sync, multi-device collaboration and remote backups are out of scope.
- Custom preset and browser-local Playground draft keys remain intentionally separate from Studio project persistence.
- Browser-local IndexedDB can be cleared or evicted. Export JSON for an off-device backup.

## Verification contract

- Run lint, typecheck, Vitest, production build and desktop/mobile Playwright E2E on **the exact final SHA**.
- Critical browser scenarios: activate → edit scene → verify IDB → graph constant update → Coursework draft → reload → project CRUD snapshot; stale-tab same-project collision → rejection and no IDB revision bump.
- Test legacy mode regression, v1 migration, checkpoint save/restore, invalid/corrupt record and failed storage startup.
- Recheck after stacking dependency PRs #30 → #31 → #32 and base retargeting.

## Additional recovery and navigation behavior

The failed-hydration UI can export the valid authoritative IndexedDB snapshot **without starting an editor**, as well as the last validated local mirror. Explicit fallback to a validated local copy preserves the IndexedDB record for later recovery. A pending write triggers the browser's before-unload warning where the browser permits it; this is not an fsync guarantee on abrupt shutdown. Gallery `/studio?kind=...` launches create a new durable project and remove the query parameter only after a successful commit, rather than overriding existing Scene data. Coursework uses latest-edit receipt tracking so an older completed write does not falsely mark newer unsaved text as saved.
