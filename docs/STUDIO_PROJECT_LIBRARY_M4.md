# Studio Project Library — M4

## Project semantics

`/studio` now provides a **Projects** dialog for up to 20 named local projects. Each project stores one validated `MathDocument` and `NodeGraph` snapshot. Users may create, switch, rename, duplicate and delete projects. The final project cannot be deleted.

- Browser `localStorage["paramyra.studio.projects.v1"]` is the authoritative registry containing complete snapshots.
- The previous `paramyra.document.v3` and `paramyra.nodegraph.v3` keys are maintained as compatibility mirrors for existing Studio and Node Graph consumers.
- Loading the registry migrates an existing document and graph into the first project. It does not delete legacy storage keys.
- Switching projects persists the scene and graph mirror and resets Studio's in-memory undo/redo history.
- A save failure returns an error and attempts to restore previous values of the registry and both mirrors. Since browser localStorage is not a transactional database, this is best-effort rollback, not ACID durability.
- Node Graph save, static graph output apply, and full-project bundle import write the active project snapshot, preserving the others.
- Coursework drafts use a project-scoped key. The first historical project may also read legacy unscoped drafts, while duplicated/new projects cannot share their drafts.
- Playground Open in Studio creates a session-only draft; saving it now creates a new library entry, never replaces an existing named project.

## Boundaries and risks

- Browser-local only: no cloud sync, account authentication, multi-device backup, project permissions or shared collaboration.
- Up to 20 projects, registry serialized payload limited to 1,000,000 characters. Users should **Export JSON** for independent backups and expect storage quota failures.
- Multi-tab editing is last-write-wins. A later revision/CAS protocol, IndexedDB persistence and cloud synchronization may be appropriate after this milestone.
- Existing exported project bundle format is unchanged and can still be imported into the currently active project.
- Routing to Studio from Gallery via a preset query still follows its legacy behavior: confirm which project should receive an imported gallery preset before advanced project workflows.

## Verification

`src/core/projects/studio-library.test.ts` checks migration, independent snapshots, rollback, limits and CRUD semantics.

`tests/e2e/studio-project-library-m4.spec.ts` exercises project creation, switching, duplication, rename, delete, graph isolation and mobile layout; `tests/e2e/playground-v2.spec.ts` checks non-destructive transfer.

The previous Graph/Coursework tests were hardened against initial asynchronous storage hydration and unstable JSON key ordering. Manual browser screenshot and physical touch QA are still recommended prior to release.
