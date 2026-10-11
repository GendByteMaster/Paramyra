# Paramyra M4.2 — Transactional Recovery Checkpoint Foundation

## What is implemented

This increment adds an **explicit recovery checkpoint** in IndexedDB, independently of the existing synchronous Studio Project Library in localStorage. The checkpoint contains a complete validated Library v2 snapshot (Scene v3, graph v3, authored keyframes, Coursework).

- Dedicated database `paramyra-studio-checkpoints`, object store `snapshots`, singleton record `studio-library`, schema version 1.
- A `readwrite` transaction checks the current revision and writes revision + 1 **in the same transaction**. Stale expected revisions fail closed with a `conflict` status; malformed existing records are never overwritten.
- The Project Library exposes **Save checkpoint** and **Restore checkpoint**, plus status/verification messages.
- Restore requires an explicit confirmation, validates the latest checkpoint revision and writes registry/compatibility mirrors through the existing best-effort rollback path. The page then reloads to reconstruct editor history.
- Exported JSON remains the recommended backup for moving data between devices; IndexedDB can also be evicted by the browser.
- Studio, Node Graph and Coursework editor autosave calls carry an expected active project ID. A stale tab with a different project selected cannot write into the newly active project through these scoped calls.

## Deliberate boundaries — not an IndexedDB cutover

**The checkpoint is NOT the authoritative live editor store yet.** Normal edit persistence still uses localStorage and does not use IndexedDB transaction isolation. Opening different tabs and editing the same project remains **last-write-wins**. The active project-ID guard prevents one class of accidental cross-project corruption but is not a revision/CAS protocol for normal edits.

Do not describe this release as transactional real-time autosave, atomic multi-tab collaboration, or automatic recovery after browser closure. A user must deliberately save a recovery checkpoint. Restoration overwrites the current browser-local Project Library and therefore requires confirmation.

## Why the rollout is staged

Automatically swapping synchronous editor reads/writes for asynchronous IDB writes without converting all Scene/Graph/Timeline/Playground import flows to a single transaction would introduce split-brain state and possible data loss. This foundation establishes the validated transaction mechanism and its UI before that migration.

## Follow-up needed for the complete M4.2 cutover

1. Migrate every active project writer to an async IDB repository, including scene edits, graph edits, reports, project CRUD and imports.
2. Hydrate the workspace from the authoritative IDB state before editor mounts and before any autosave effect runs.
3. Use optimistic revisions for *every* edit and expose conflict resolution with export/refresh, not silent merges.
4. Remove localStorage mirror authority only after older integrations are adapted and migration/recovery tests prove no data loss.
5. Exercise browser quota, storage eviction, interrupted transactions, multi-tab collisions and offline recovery.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Tests should cover schema validation, revision matching, IndexedDB save/restore in Chromium, stale-tab conflict rejection, and scoping guards. Manual Safari/Firefox and touch-device verification remain future acceptance gates.
