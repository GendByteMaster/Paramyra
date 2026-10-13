import { describe, expect, it } from "vitest";
import { createPhysicsProject, physicsProjectSchema, type PhysicsProject } from "../model/schema";
import type { SimulationFrame } from "../engine/simulation";
import {
  PHYSICS_RUNTIME_MAX_RUN_LAG_MS,
  PHYSICS_RUNTIME_TICK_MS,
  PhysicsRuntimeController,
  type PhysicsRuntimeDependencies,
  type PhysicsSimulationLike,
  type RuntimeScheduler,
} from "./runtime-controller";
import { PHYSICS_WORKER_PROTOCOL_VERSION, type PhysicsWorkerResponse } from "./protocol";

function frame(step: number, terminated = false): SimulationFrame {
  return {
    step,
    time: step / 1_000,
    position: { x: step, y: 0 },
    velocity: { x: 1, y: 0 },
    acceleration: { x: 0, y: 0 },
    force: { x: 0, y: 0 },
    kineticEnergy: 0.5,
    potentialEnergy: 0,
    totalEnergy: 0.5,
    terminated,
    ...(terminated ? { terminationReason: "duration" as const } : {}),
  };
}

class FakeSimulation implements PhysicsSimulationLike {
  private current: SimulationFrame = frame(0);
  constructor(private readonly maximumSteps: number, private readonly onStep?: () => void) {}
  get frame(): SimulationFrame { return this.current; }
  step(count = 1): SimulationFrame {
    for (let index = 0; index < count && !this.current.terminated; index++) {
      this.onStep?.();
      const step = this.current.step + 1;
      this.current = frame(step, step >= this.maximumSteps);
    }
    return this.current;
  }
  reset(): SimulationFrame {
    this.current = frame(0);
    return this.current;
  }
}

class FakeScheduler implements RuntimeScheduler {
  private clock = 0;
  private nextId = 0;
  private tasks = new Map<number, { due: number; callback: () => void }>();
  schedule(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const id = ++this.nextId;
    this.tasks.set(id, { due: this.clock + Math.max(0, delayMs), callback });
    return id as unknown as ReturnType<typeof setTimeout>;
  }
  cancel(handle: ReturnType<typeof setTimeout>): void {
    this.tasks.delete(handle as unknown as number);
  }
  now(): number { return this.clock; }
  advanceBy(milliseconds: number): void {
    const target = this.clock + milliseconds;
    for (let count = 0; count < 10_000; count++) {
      const next = [...this.tasks.entries()].sort((a, b) => a[1].due - b[1].due)[0];
      if (!next || next[1].due > target) break;
      this.tasks.delete(next[0]);
      this.clock = next[1].due;
      next[1].callback();
    }
    this.clock = Math.max(this.clock, target);
  }
  elapseWithoutRunning(milliseconds: number): void { this.clock += milliseconds; }
  runNextDue(): void {
    const next = [...this.tasks.entries()].sort((a, b) => a[1].due - b[1].due)[0];
    if (!next || next[1].due > this.clock) return;
    this.tasks.delete(next[0]);
    next[1].callback();
  }
  flushDue(): void {
    for (let count = 0; count < 10_000; count++) {
      const next = [...this.tasks.entries()].sort((a, b) => a[1].due - b[1].due)[0];
      if (!next || next[1].due > this.clock) return;
      this.tasks.delete(next[0]);
      next[1].callback();
    }
    throw new Error("Fake scheduler did not quiesce.");
  }
  pendingCount(): number { return this.tasks.size; }
}

function projectForSteps(steps: number, maximumSubsteps = 128): PhysicsProject {
  const base = createPhysicsProject("spring");
  return physicsProjectSchema.parse({
    ...base,
    simulation: { ...base.simulation, fixedTimeStep: 0.001, duration: steps / 1_000, maximumSubsteps, sampleEvery: 1 },
  });
}

function projectForPlayback(): PhysicsProject {
  const base = createPhysicsProject("spring");
  return physicsProjectSchema.parse({
    ...base,
    simulation: { ...base.simulation, fixedTimeStep: 0.01, duration: 10, maximumSubsteps: 8, sampleEvery: 1 },
  });
}

function request(sessionId: number, requestId: number, type: string, fields: Record<string, unknown> = {}) {
  return { protocolVersion: PHYSICS_WORKER_PROTOCOL_VERSION, sessionId, requestId, type, ...fields };
}

function setup(project: PhysicsProject, overrides: Partial<PhysicsRuntimeDependencies> = {}) {
  const scheduler = overrides.scheduler ?? new FakeScheduler();
  const responses: PhysicsWorkerResponse[] = [];
  const controller = new PhysicsRuntimeController(response => responses.push(response), {
    scheduler,
    createSimulation: overrides.createSimulation ?? (() => new FakeSimulation(Math.ceil(project.simulation.duration / project.simulation.fixedTimeStep))),
    cpuBudgetMs: overrides.cpuBudgetMs,
  });
  const clock = scheduler as FakeScheduler;
  controller.receive(request(7, 1, "initialize", { project }));
  return { controller, responses, scheduler: clock };
}

function latestSnapshot(responses: PhysicsWorkerResponse[]) {
  const latest = responses[responses.length - 1];
  if (!latest || latest.type !== "snapshot") throw new Error("Expected a worker snapshot.");
  return latest;
}

describe("bounded physics worker runtime controller", () => {
  it("accumulates elapsed time into bounded integer fixed steps", () => {
    const project = projectForPlayback();
    const { controller, responses, scheduler } = setup(project);
    controller.receive(request(7, 2, "run"));
    expect(latestSnapshot(responses).status).toBe("running");
    scheduler.advanceBy(PHYSICS_RUNTIME_TICK_MS);
    expect(latestSnapshot(responses).frame?.step).toBe(1);
    expect(latestSnapshot(responses).status).toBe("running");
    scheduler.advanceBy(PHYSICS_RUNTIME_TICK_MS);
    expect(latestSnapshot(responses).frame?.step).toBe(3);
  });

  it("pauses with an explicit lag error instead of replaying missed wall-clock ticks", () => {
    const { controller, responses, scheduler } = setup(projectForSteps(1_000));
    controller.receive(request(7, 2, "run"));
    scheduler.elapseWithoutRunning(PHYSICS_RUNTIME_MAX_RUN_LAG_MS + 1);
    scheduler.runNextDue();
    expect(latestSnapshot(responses).status).toBe("error");
    expect(latestSnapshot(responses).frame?.step).toBe(0);
    expect(latestSnapshot(responses).error).toContain("No catch-up steps were applied");
    expect(latestSnapshot(responses).diagnostics.lagEvents).toBe(1);
  });

  it("rejects accumulated work above the project's per-tick substep limit", () => {
    const { controller, responses, scheduler } = setup(projectForSteps(1_000, 8));
    controller.receive(request(7, 2, "run"));
    scheduler.advanceBy(PHYSICS_RUNTIME_TICK_MS);
    expect(latestSnapshot(responses).status).toBe("error");
    expect(latestSnapshot(responses).frame?.step).toBe(0);
    expect(latestSnapshot(responses).error).toContain("above the project's 8-substep limit");
  });

  it("pauses after a worker tick exceeds its compute budget", () => {
    const scheduler = new FakeScheduler();
    const { controller, responses } = setup(projectForPlayback(), {
      scheduler,
      createSimulation: project => new FakeSimulation(
        Math.ceil(project.simulation.duration / project.simulation.fixedTimeStep),
        () => scheduler.elapseWithoutRunning(9),
      ),
    });
    controller.receive(request(7, 2, "run"));
    scheduler.advanceBy(PHYSICS_RUNTIME_TICK_MS);
    expect(latestSnapshot(responses).status).toBe("error");
    expect(latestSnapshot(responses).frame?.step).toBe(1);
    expect(latestSnapshot(responses).error).toContain("exceeded its 8 ms CPU budget");
  });

  it("enforces the CPU budget when a manual step terminates the simulation", () => {
    const scheduler = new FakeScheduler();
    const project = projectForSteps(1);
    const { controller, responses } = setup(project, {
      scheduler,
      createSimulation: currentProject => new FakeSimulation(
        Math.ceil(currentProject.simulation.duration / currentProject.simulation.fixedTimeStep),
        () => scheduler.elapseWithoutRunning(9),
      ),
    });

    controller.receive(request(7, 2, "step", { count: 1 }));

    expect(latestSnapshot(responses).status).toBe("error");
    expect(latestSnapshot(responses).frame?.terminated).toBe(true);
    expect(latestSnapshot(responses).diagnostics.lastWorkMs).toBe(9);
    expect(latestSnapshot(responses).error).toContain("Step paused because its work exceeded the 8 ms CPU budget");
  });

  it("yields seek replay at half the CPU budget and completes across bounded chunks", () => {
    const scheduler = new FakeScheduler();
    const project = projectForSteps(120);
    let stepCalls = 0;
    const { controller, responses } = setup(project, {
      scheduler,
      cpuBudgetMs: 8,
      createSimulation: currentProject => new FakeSimulation(
        Math.ceil(currentProject.simulation.duration / currentProject.simulation.fixedTimeStep),
        () => {
          stepCalls++;
          scheduler.elapseWithoutRunning(2);
        },
      ),
    });

    controller.receive(request(7, 2, "seek", { targetStep: 120 }));
    scheduler.runNextDue();

    const firstChunk = latestSnapshot(responses);
    expect(stepCalls).toBe(2);
    expect(firstChunk.frame?.step).toBeLessThanOrEqual(2);
    expect(firstChunk.status).toBe("paused");
    expect(scheduler.pendingCount()).toBe(1);

    scheduler.flushDue();

    const completed = latestSnapshot(responses);
    expect(stepCalls).toBe(120);
    expect(completed.status).toBe("completed");
    expect(completed.frame).toEqual(new FakeSimulation(120).step(120));
    expect(scheduler.pendingCount()).toBe(0);
  });

  it("fails seek when one replay chunk exceeds the full CPU budget", () => {
    const scheduler = new FakeScheduler();
    const project = projectForSteps(120);
    const { controller, responses } = setup(project, {
      scheduler,
      cpuBudgetMs: 8,
      createSimulation: currentProject => new FakeSimulation(
        Math.ceil(currentProject.simulation.duration / currentProject.simulation.fixedTimeStep),
        () => scheduler.elapseWithoutRunning(9),
      ),
    });

    controller.receive(request(7, 2, "seek", { targetStep: 120 }));
    scheduler.runNextDue();

    const failed = latestSnapshot(responses);
    expect(failed.status).toBe("error");
    expect(failed.frame?.step).toBe(1);
    expect(failed.diagnostics.lastWorkMs).toBe(9);
    expect(failed.error).toContain("Seek paused because a replay chunk exceeded the 8 ms CPU budget");
    expect(scheduler.pendingCount()).toBe(0);
  });

  it("cancels a chunked seek when a newer pause command invalidates its token", () => {
    const { controller, responses, scheduler } = setup(projectForSteps(1_000, 50));
    controller.receive(request(7, 2, "seek", { targetStep: 700 }));
    scheduler.runNextDue();
    expect(latestSnapshot(responses).frame?.step).toBe(50);
    expect(scheduler.pendingCount()).toBe(1);
    controller.receive(request(7, 3, "pause"));
    const countAfterPause = responses.length;
    scheduler.flushDue();
    expect(responses).toHaveLength(countAfterPause);
    expect(latestSnapshot(responses).status).toBe("paused");
    expect(latestSnapshot(responses).frame?.step).toBe(50);
  });

  it("replays seeks from reset and caps retained trajectory samples", () => {
    const { controller, responses, scheduler } = setup(projectForSteps(4_000, 128));
    controller.receive(request(7, 2, "step", { count: 3 }));
    expect(latestSnapshot(responses).frame?.step).toBe(3);
    controller.receive(request(7, 3, "seek", { targetStep: 4_000 }));
    scheduler.flushDue();
    const result = latestSnapshot(responses);
    expect(result.frame?.step).toBe(4_000);
    expect(result.status).toBe("completed");
    expect(result.samples.length).toBeLessThanOrEqual(2_048);
    expect(result.diagnostics.sampleCount).toBe(result.samples.length);
    expect(result.diagnostics.effectiveSampleEvery).toBeGreaterThan(1);
  });

  it("rejects stale session and request IDs and fails closed on unknown request fields", () => {
    const { controller, responses } = setup(projectForSteps(100));
    const afterInit = responses.length;
    controller.receive(request(6, 100, "run"));
    controller.receive(request(7, 1, "run"));
    expect(responses).toHaveLength(afterInit);
    controller.receive({ ...request(7, 2, "pause"), extra: "invalid" });
    expect(latestSnapshot(responses).status).toBe("error");
    expect(latestSnapshot(responses).error).toContain("strict protocol");
  });
});
