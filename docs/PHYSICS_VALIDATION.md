# Physics P0/P1 acceptance evidence

Scope: [Epic #34](https://github.com/GendByteMaster/Paramyra/issues/34), foundation
and the first two mechanics models. Base `dev/master`: `845313c` (fetched again
October 13, 2026, unchanged). No main changes, deployment, production migration,
or merge are part of this delivery. The epic remains open.

## Acceptance matrix

| Contract | Evidence |
| --- | --- |
| Independent Physics domain and routing | Four ADRs in PHYSICS_ARCHITECTURE.md; dedicated Physics routes, schema, engine, repository, runtime and Canvas modules |
| Versioned finite SI project | Strict schema/units tests reject unknown fields, future versions, dimension mismatches, invalid ranges and stability/budget violations |
| Projectile and spring correctness | Independent analytical references, exact discrete projectile reference, step refinement, damped/undamped spring fixtures, ground-event regression, energy bounds and deterministic reset/replay |
| Worker execution | Strict protocol and execution-key tests; injected-scheduler tests for lag, CPU limits, cancellation, bounded history and seek; browser stepping/run/pause/reset/seek and startup failure/retry |
| One durable authority | Existing IndexedDB database/store and distinct Physics record; CAS revision/active-ID checks and atomic commit; aborted writes and concurrent-tab tests |
| Safe restore/import | Real-browser project/report reopen and replay, fresh-ID JSON round trip, unsupported import rejection, corrupt/future record preservation in Math legacy and opt-in modes |
| Measurements | Model/time/termination invariants, bounded CSV/JSON with units and provenance; browser download and independent numerical assertions; accessible table |
| Authored state | Camera/report edits preserve simulation state; pending save retains newer edits; explicit save, conflict export and reload |
| Mathematics compatibility | Existing unit and browser suites for Gallery/Playground/Studio, Timeline, Graph, Coursework and both persistence modes run together with Physics |
| Visual/accessibility baseline | Desktop/mobile Chromium screenshots, overflow assertion, light/dark and reduced-motion CSS, labelled keyboard controls and accessible Canvas/data table |

No historical Physics migration is invented: v1 is the initial format. Future
versions fail closed. Existing Mathematics schema and storage migrations remain
in their original modules and regression suites.

## Local verification — October 13, 2026

| Command | Result |
| --- | --- |
| `npm run lint` | Passed: zero errors; three pre-existing Mathematics navigation warnings |
| `npm run typecheck` | Passed |
| `npm test` | Passed: 30 files, 149 tests |
| `npm run build` | Passed: Next.js 16 production build, including all Physics routes |
| `npm run test:e2e` | Passed: 279 scenarios, one existing skip, 4.7 minutes, two local workers, no retries |

The existing skip is mobile headless fullscreen in `workspace.spec.ts`: mobile
emulation advertises support but the request may never resolve. Desktop real
fullscreen passes. No Physics scenario is skipped. The combined browser suite
covers Mathematics Graph, Timeline, Coursework and legacy/IndexedDB storage.
Exact feature-HEAD CI results are recorded in the pull request.

## Numerical fixture tolerances

Projectile uses velocity-first Euler. The vacuum discrete position is
`y_n=y_0+v_0*t-g*(t*t+h*t)/2`, compared independently to both that recurrence's
closed form and the continuous ballistic model. Linear drag is checked against
its exponential solution and step refinement. Contact follows the integrator's
partial step, and is checked against that policy plus convergence to continuous
impact; it is not claimed to be exact ballistic contact.

The spring's undamped energy drift over 1,000 default steps is below 0.04 J
for an initial 2 J fixture. Its refined displacement error decreases, and the
underdamped 1-second fixture at `h=0.0005 s` matches analytical displacement to
three decimal places. Browser seek at default `h=1/120 s` uses observable-specific
tolerances of 0.01 m and 0.001 m/s. Full-precision measurement exports are checked
separately from rounded readouts. These bounds apply to the stated fixtures,
not all admitted parameters.

## Repeatable performance fixture

Run `npm test` or `npx vitest run src/core/physics/benchmark.test.ts`. A spring
with `h=1/240 s` advances 600 logical seconds (144,000 steps); timing is printed
as `[physics-benchmark]`. A second fixture verifies the 2,048-sample cap and final
ground-contact sample. There is no hardware-dependent performance assertion.

Local conditions: Windows x64, AMD Ryzen 5 2400G, Node 26.5.1, eight available
logical processors, concurrent Vitest workers. The October 13 full-suite run
measured 10,126.36 ms / 14,220 steps per second while the production build was
running concurrently; contention changes this number.
This measures headless solver throughput, not browser rendering or a 60 FPS
promise. CI uses Ubuntu and Node 22. Browser p50/p95 frame times and real
10-minute wall-clock interaction remain release profiling work.

Playwright runs two concurrent browsers locally and one in CI. The earlier four-browser run exposed
test reads made before asynchronous measurement rows arrived; those reads now
wait for the worker result. It also activated the unchanged 8 ms elapsed-work
guard under contention. Browser concurrency is bounded rather than disabling
runtime protection: injected-scheduler tests still require CPU/lag overruns to
pause with diagnostics. Elapsed time includes GC and OS preemption; this is not
a claim of uninterrupted playback on a saturated machine.

## Delivery limitations and next stage

P1 Studio edits one experiment/body with explicit save. It is not a general
multi-body scene editor. P2 still needs object authoring and undo/redo, pendulum
and inclined plane, guided labs, configurable plots and print reports,
resizable/collapsible panels and expanded manual accessibility/browser review.
P3 still needs the independently typed React Flow Physics Graph and explicit
Math↔Physics conversion UI/compiler. P4 covers orbital mechanics, sweeps,
alternative integrators, optional 3D and subsequent scientific domains.

The unit layer supports conversions, but the MVP Inspector accepts canonical
SI inputs only; selectable display/input units are follow-up work. Measurements
are bounded live history and exports, not durable recordings. Imported external
measurement snapshots are structurally checked, not certified engine results.

Manual Firefox/Safari, real touch hardware, screen-reader sessions, print/PDF and
rendering-performance acceptance are not claimed by Chromium automation. This
PR should remain draft until its exact final HEAD CI and relevant manual release
gates have been reviewed. No epic checkbox is marked complete by this document.
