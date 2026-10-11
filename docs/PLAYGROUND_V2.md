# Playground v2: experiment isolation and Studio handoff

## Distinct workspaces

- **Explore** (`/explore`): curated mathematical gallery.
- **Playground** (`/playground`): single-scene quick experimentation without project editing or graph/timeline history. Predefined mathematical forms, numeric/range controls, live canvas, playback, and randomized valid parameters.
- **Studio** (`/studio`): saved `MathDocument` (layers, keyframes, animation, export), plus undo/redo and collaboration-independent browser persistence.
- **Node Graph** (`/studio/graph`): computational DAG attached to Studio documents.
- **Coursework**: documentation/presentation surface attached to Node Graph.

## Persistence invariants

1. Playground writes **only** `sessionStorage["paramyra.playground.experiment.v2"]`, scoped to the browser tab. It never writes `paramyra.document.v3` and does not read Studio's stored document.
2. `Open in Studio` explicitly converts a strictly validated `SceneDocument` into a **new ID** `MathDocument`; a per-tab handoff is stored under `paramyra.playground.transfer.v1` with a random token.
3. On the route `/studio?playgroundTransfer=<token>`, Studio accepts only a token matching a valid handoff already in the same tab. Imported drafts live under `sessionStorage["paramyra.playground.studio-draft.v1."+token]`; all intermediate Studio edits use this key.
4. While in transfer mode, Studio does **not** write the active `paramyra.document.v3` key, does not adopt other tabs' `storage` events for that document, and does not evaluate any previously saved Node Graph against the new imported document.
5. Saving requires pressing **Save to Studio**; if a persisted Studio document exists, the browser confirms replacement before committing. Cancel or discard does not modify the saved document. Successful save commits the document, deletes transfer state and removes the URL token.
6. Corrupt, unsupported, excessively large or forged transfer payloads are ignored, falling back to the existing Studio document. The transfer is a UI draft, **not** a security boundary against scripts with same-origin access.
7. This version retains Studio's existing single-active-project persistence semantics. A true project library (many named documents) is a separate roadmap feature; this implementation does not claim to create multiple durable project slots.

## E2E acceptance

`tests/e2e/playground-v2.spec.ts` covers independent storage, per-tab session reload, transfers, rejection of forged URL tokens, replacement confirmation, discard, reduced-motion/mobile layout and Playground-only controls.

### Trade-offs

Playground's experiment is temporary per browser tab, as deliberately chosen: it is not synchronized between tabs and is not a durable backup. Session storage may be disabled by browser policy; in that case the experiment remains usable in memory but the explicit transfer action reports a failure rather than silently overwriting Studio data.

The parameter schema, simulation renderer, scene preset definitions and math engine are reused from Studio; application state management and UI surface are intentionally separate to prevent divergence in numeric semantics.
