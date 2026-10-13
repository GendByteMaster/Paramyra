# Physics worker runtime

The worker boundary is version 1 and accepts strict messages only. Each request
has a positive safe-integer `sessionId` and a strictly increasing positive
`requestId`; a session is initialized once with a schema-validated
`PhysicsProject`. The supported commands are `initialize`, `run`, `pause`,
`step`, `reset`, `seek`, and `dispose`. Invalid messages fail the current
session closed with a visible error. Messages from another session or duplicate
and out-of-order request IDs are ignored.

Snapshots carry the current `SimulationFrame`, a trajectory sample list capped
at 2,048 frames, status, error text, and bounded diagnostics. Project
`sampleEvery` controls initial recording density; if a long run reaches the
sample cap, the runtime decimates older samples and doubles the effective
sampling interval. The final termination frame is always retained.

Playback uses a wall-clock accumulator to calculate how many integer fixed-time
steps are due. It processes at most the project's `maximumSubsteps` per worker
tick and never carries out an unbounded catch-up loop. If scheduling is delayed
by more than 250 ms, the accumulated step count exceeds that limit, or a tick
exceeds the 8 ms compute budget, playback pauses with an error. A short delay
that remains inside those limits is caught up in a bounded batch. Manual step
batches use the same project limit and shared 10,000-step schema bound. `seek`
resets and deterministically replays from step zero in cancellable chunks no
larger than `min(maximumSubsteps, 256)`; each chunk is also constrained by the
CPU budget. Seek replay yields once measured work reaches half of that budget so
normal multi-step seeks can continue across scheduler turns; a chunk that still
exceeds the full budget reports an error, including when one step is too slow.
The browser implementation measures elapsed work with `performance.now()`, not
isolated CPU time. Garbage collection and operating-system preemption can count
toward the limit; contention can therefore pause a valid model. The diagnostic
is a runtime protection, not evidence that its governing equations are invalid.
Pause, reset, dispose, and newer commands invalidate outstanding
scheduled callbacks through a generation token.

`usePhysicsRuntime(project)` creates one module worker with Next.js's statically
analyzable `new URL(..., import.meta.url)` form. The execution key contains
project ID, model/version/parameters, and simulation settings. Changing only
the project name, timestamps, scene/camera, or lab report leaves the worker and
live frame intact. An execution-key change or explicit `restart()` disposes
the prior worker and starts a new monotonic session. Session and request checks
prevent stale responses from replacing current UI state. Worker construction
and execution failures are surfaced to the UI; there is no main-thread solver
fallback.
