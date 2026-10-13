import { describe, expect, it } from "vitest";
import { PhysicsSimulation } from "./engine/simulation";
import { createPhysicsProject, parsePhysicsProject } from "./model/schema";
import {
  PHYSICS_MAX_SAMPLES,
  PHYSICS_WORKER_PROTOCOL_VERSION,
  parsePhysicsWorkerResponse,
  type PhysicsWorkerResponse,
} from "./worker/protocol";
import {
  PhysicsRuntimeController,
  type RuntimeScheduler,
} from "./worker/runtime-controller";

describe("Physics numerical performance fixtures", () => {
  it("measures ten minutes of fixed-step oscillator playback", () => {
    const base = createPhysicsProject("spring", "physics-benchmark-spring", 1);
    const project = parsePhysicsProject({
      ...base,
      simulation: {
        ...base.simulation,
        fixedTimeStep: 1 / 240,
        duration: 600,
        maximumSubsteps: 1_000,
        sampleEvery: 1,
      },
      model: {
        ...base.model,
        parameters: {
          ...base.model.parameters,
          mass: 1,
          stiffness: 4,
          damping: 0.2,
          displacement: 1,
          velocity: 0,
        },
      },
    });
    expect(project).not.toBeNull();
    if (!project || project.model.kind !== "spring") throw new Error("Expected a valid spring benchmark project");

    const simulation = new PhysicsSimulation(project);
    const totalSteps = Math.round(project.simulation.duration / project.simulation.fixedTimeStep);
    const batchSize = project.simulation.maximumSubsteps;
    const startedAt = performance.now();
    for (let remaining = totalSteps; remaining > 0; remaining -= batchSize) {
      simulation.step(Math.min(batchSize, remaining));
    }
    const elapsedMs = performance.now() - startedAt;
    const frame = simulation.frame;

    expect(totalSteps).toBe(144_000);
    expect(frame.step).toBe(totalSteps);
    expect(frame.time).toBe(600);
    expect(frame.terminated).toBe(true);
    expect(Number.isFinite(frame.position.x)).toBe(true);
    expect(Number.isFinite(frame.totalEnergy)).toBe(true);
    // Keep the measurement visible in `npm test` output without imposing a
    // hardware-dependent timing threshold on CI.
    console.info(
      `[physics-benchmark] spring logical=600s steps=${totalSteps} dt=${project.simulation.fixedTimeStep}s elapsed=${elapsedMs.toFixed(2)}ms stepsPerSecond=${Math.round(totalSteps / (elapsedMs / 1_000))}`,
    );
  }, 30_000);

  it("caps worker samples and preserves the natural projectile impact frame", () => {
    const base = createPhysicsProject("projectile", "physics-benchmark-projectile", 1);
    const project = parsePhysicsProject({
      ...base,
      simulation: {
        ...base.simulation,
        fixedTimeStep: 0.005,
        duration: 30,
        maximumSubsteps: 1_000,
        sampleEvery: 1,
      },
      model: {
        ...base.model,
        parameters: {
          ...base.model.parameters,
          mass: 1,
          gravity: 9.81,
          drag: 0,
          initialX: 0,
          initialY: 1,
          velocityX: 10,
          velocityY: 100,
        },
      },
    });
    expect(project).not.toBeNull();
    if (!project) throw new Error("Expected a valid projectile benchmark project");

    let nextHandle = 1;
    const callbacks = new Map<number, () => void>();
    const scheduler: RuntimeScheduler = {
      schedule(callback) {
        const handle = nextHandle++;
        callbacks.set(handle, callback);
        return handle as unknown as ReturnType<typeof setTimeout>;
      },
      cancel(handle) {
        callbacks.delete(handle as unknown as number);
      },
      // Synchronous step requests do not schedule work. A fixed clock removes
      // wall-clock variance from the worker's per-batch budget in this fixture.
      now: () => 0,
    };
    const snapshots: PhysicsWorkerResponse[] = [];
    const runtime = new PhysicsRuntimeController(response => snapshots.push(response), {
      createSimulation: value => new PhysicsSimulation(value),
      scheduler,
      cpuBudgetMs: 100,
    });

    runtime.receive({
      protocolVersion: PHYSICS_WORKER_PROTOCOL_VERSION,
      sessionId: 17,
      requestId: 1,
      type: "initialize",
      project,
    });
    for (let requestId = 2; requestId <= 7; requestId++) {
      runtime.receive({
        protocolVersion: PHYSICS_WORKER_PROTOCOL_VERSION,
        sessionId: 17,
        requestId,
        type: "step",
        count: 1_000,
      });
    }

    const lastResponse = snapshots.at(-1);
    expect(lastResponse?.type).toBe("snapshot");
    if (lastResponse?.type !== "snapshot") throw new Error("Expected a worker snapshot");
    expect(parsePhysicsWorkerResponse(lastResponse)).toEqual(lastResponse);
    expect(lastResponse.status).toBe("completed");
    expect(lastResponse.frame?.terminationReason).toBe("ground-contact");
    expect(lastResponse.frame?.position.y).toBe(0);
    expect(lastResponse.frame?.step).toBeGreaterThan(PHYSICS_MAX_SAMPLES);
    expect(lastResponse.samples.length).toBeLessThanOrEqual(PHYSICS_MAX_SAMPLES);
    expect(lastResponse.diagnostics.sampleCount).toBe(lastResponse.samples.length);
    expect(lastResponse.diagnostics.effectiveSampleEvery).toBeGreaterThan(1);
    expect(lastResponse.samples.at(-1)).toEqual(lastResponse.frame);
    runtime.dispose();
  });
});
