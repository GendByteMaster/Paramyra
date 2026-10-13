import { PHYSICS_MAX_BATCH_STEPS, PHYSICS_MAX_TOTAL_STEPS, type PhysicsProject } from "../model/schema";
import type { SimulationFrame } from "../engine/simulation";
import {
  PHYSICS_MAX_SAMPLES,
  PHYSICS_WORKER_PROTOCOL_VERSION,
  parsePhysicsWorkerRequest,
  type PhysicsRuntimeDiagnostics,
  type PhysicsRuntimeStatus,
  type PhysicsWorkerResponse,
  type PhysicsWorkerSnapshot,
  type ValidatedPhysicsWorkerRequest,
} from "./protocol";

export const PHYSICS_RUNTIME_CPU_BUDGET_MS = 8;
export const PHYSICS_RUNTIME_TICK_MS = 16;
export const PHYSICS_RUNTIME_MAX_SEEK_CHUNK = 256;
export const PHYSICS_RUNTIME_MAX_RUN_LAG_MS = 250;

export interface PhysicsSimulationLike {
  readonly frame: SimulationFrame;
  step(count?: number): SimulationFrame;
  reset(): SimulationFrame;
}

export interface RuntimeScheduler {
  schedule(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  cancel(handle: ReturnType<typeof setTimeout>): void;
  now(): number;
}

export interface PhysicsRuntimeDependencies {
  createSimulation(project: PhysicsProject): PhysicsSimulationLike;
  scheduler?: RuntimeScheduler;
  cpuBudgetMs?: number;
}

const defaultScheduler: RuntimeScheduler = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: handle => clearTimeout(handle),
  now: () => performance.now(),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeHeader(value: unknown): { sessionId: number; requestId: number; protocolVersion: number } | null {
  if (!isRecord(value)) return null;
  const { sessionId, requestId, protocolVersion } = value;
  if (!Number.isSafeInteger(sessionId) || (sessionId as number) <= 0
    || !Number.isSafeInteger(requestId) || (requestId as number) <= 0
    || !Number.isSafeInteger(protocolVersion)) return null;
  return { sessionId: sessionId as number, requestId: requestId as number, protocolVersion: protocolVersion as number };
}

export class PhysicsRuntimeController {
  private readonly createSimulation: (project: PhysicsProject) => PhysicsSimulationLike;
  private readonly scheduler: RuntimeScheduler;
  private readonly cpuBudgetMs: number;
  private readonly emit: (response: PhysicsWorkerResponse) => void;
  private sessionId: number | null = null;
  private lastRequestId = 0;
  private activeRequestId = 0;
  private simulation: PhysicsSimulationLike | null = null;
  private project: PhysicsProject | null = null;
  private status: PhysicsRuntimeStatus = "idle";
  private error: string | null = null;
  private samples: SimulationFrame[] = [];
  private effectiveSampleEvery = 1;
  private lastWorkMs = 0;
  private lagEvents = 0;
  private scheduled: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private lastTickAt: number | null = null;
  private accumulatedSeconds = 0;
  private disposed = false;

  constructor(emit: (response: PhysicsWorkerResponse) => void, dependencies: PhysicsRuntimeDependencies) {
    this.emit = emit;
    this.createSimulation = dependencies.createSimulation;
    this.scheduler = dependencies.scheduler ?? defaultScheduler;
    this.cpuBudgetMs = Math.max(1, Math.min(dependencies.cpuBudgetMs ?? PHYSICS_RUNTIME_CPU_BUDGET_MS, 100));
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancelScheduledWork();
    this.disposed = true;
  }

  receive(value: unknown): void {
    if (this.disposed) return;
    const header = safeHeader(value);
    if (!header) return;
    if (this.sessionId !== null && header.sessionId !== this.sessionId) return;
    if (header.requestId <= this.lastRequestId) return;

    this.lastRequestId = header.requestId;
    this.activeRequestId = header.requestId;
    if (this.sessionId === null) this.sessionId = header.sessionId;

    if (header.protocolVersion !== PHYSICS_WORKER_PROTOCOL_VERSION) {
      this.fail(`Unsupported physics worker protocol version ${header.protocolVersion}.`);
      return;
    }

    const request = parsePhysicsWorkerRequest(value);
    if (!request) {
      this.fail("Invalid physics worker request; the message failed strict protocol or project validation.");
      return;
    }
    if (request.sessionId !== this.sessionId) return;
    this.handle(request);
  }

  private handle(request: ValidatedPhysicsWorkerRequest): void {
    if (request.type === "dispose") {
      this.cancelScheduledWork();
      this.disposed = true;
      this.emit({
        protocolVersion: PHYSICS_WORKER_PROTOCOL_VERSION,
        sessionId: request.sessionId,
        requestId: request.requestId,
        type: "disposed",
      });
      return;
    }

    if (request.type === "initialize") {
      if (this.simulation) {
        this.fail("A physics worker session can be initialized only once.");
        return;
      }
      this.initialize(request.project);
      return;
    }

    if (!this.simulation || !this.project) {
      this.fail("Initialize a validated physics project before sending simulation commands.");
      return;
    }

    switch (request.type) {
      case "run":
        this.run();
        break;
      case "pause":
        this.cancelScheduledWork();
        this.status = this.simulation.frame.terminated ? "completed" : "paused";
        this.error = null;
        this.publish();
        break;
      case "step":
        this.cancelScheduledWork();
        this.step(request.count);
        break;
      case "reset":
        this.cancelScheduledWork();
        this.reset();
        break;
      case "seek":
        this.cancelScheduledWork();
        this.seek(request.targetStep, request.requestId, this.generation);
        break;
    }
  }

  private initialize(project: PhysicsProject): void {
    try {
      this.project = project;
      this.simulation = this.createSimulation(project);
      this.status = "idle";
      this.error = null;
      this.samples = [];
      this.effectiveSampleEvery = project.simulation.sampleEvery;
      this.addSample(this.simulation.frame, true);
      this.publish();
    } catch (error) {
      this.fail(this.errorMessage(error, "Could not initialize the physics simulation."));
    }
  }

  private run(): void {
    const simulation = this.simulation;
    const project = this.project;
    if (!simulation || !project) return;
    if (simulation.frame.terminated) {
      this.status = "completed";
      this.error = null;
      this.publish();
      return;
    }

    this.cancelScheduledWork();
    this.status = "running";
    this.error = null;
    this.accumulatedSeconds = 0;
    this.lastTickAt = this.scheduler.now();
    const token = this.generation;
    this.publish();
    this.scheduleRunTick(token, this.activeRequestId);
  }

  private scheduleRunTick(token: number, runRequestId: number): void {
    this.scheduled = this.scheduler.schedule(() => {
      this.scheduled = null;
      if (this.disposed || token !== this.generation || this.status !== "running") return;
      const startedAt = this.scheduler.now();
      const elapsed = this.lastTickAt === null ? PHYSICS_RUNTIME_TICK_MS : Math.max(0, startedAt - this.lastTickAt);
      this.lastTickAt = startedAt;
      if (elapsed > PHYSICS_RUNTIME_MAX_RUN_LAG_MS) {
        this.lagEvents++;
        this.fail(`Simulation paused after ${Math.round(elapsed)} ms of worker scheduling lag. No catch-up steps were applied.`);
        return;
      }

      const project = this.project;
      if (!project) {
        this.fail("Physics project was lost while running.");
        return;
      }
      const fixedTimeStep = project.simulation.fixedTimeStep;
      this.accumulatedSeconds += elapsed / 1_000;
      const dueSteps = Math.floor((this.accumulatedSeconds + fixedTimeStep * 1e-9) / fixedTimeStep);
      if (dueSteps > project.simulation.maximumSubsteps) {
        this.lagEvents++;
        this.fail(`Simulation paused because ${dueSteps} fixed steps accumulated in one worker tick, above the project's ${project.simulation.maximumSubsteps}-substep limit.`);
        return;
      }
      if (dueSteps === 0) {
        this.scheduleRunTick(token, runRequestId);
        return;
      }

      try {
        let completed = 0;
        while (completed < dueSteps && this.simulation && !this.simulation.frame.terminated) {
          this.stepOnce(startedAt);
          completed++;
          this.accumulatedSeconds = Math.max(0, this.accumulatedSeconds - fixedTimeStep);
          if (this.lastWorkMs > this.cpuBudgetMs) {
            this.fail(`Simulation paused because a worker tick exceeded its ${this.cpuBudgetMs} ms CPU budget.`);
            return;
          }
        }
      } catch (error) {
        this.fail(this.errorMessage(error, "Simulation step failed."));
        return;
      }
      this.lastWorkMs = Math.max(0, this.scheduler.now() - startedAt);
      if (this.simulation?.frame.terminated) {
        this.status = "completed";
        this.error = null;
        this.publish(runRequestId);
        return;
      }
      this.publish(runRequestId);
      this.scheduleRunTick(token, runRequestId);
    }, PHYSICS_RUNTIME_TICK_MS);
  }

  private step(count: number): void {
    const project = this.project;
    if (!project || !this.simulation) return;
    const perTickLimit = Math.min(project.simulation.maximumSubsteps, PHYSICS_MAX_BATCH_STEPS);
    if (count > perTickLimit) {
      this.fail(`Step request exceeds the project's ${perTickLimit}-substep batch limit.`);
      return;
    }
    this.status = "paused";
    this.error = null;
    const startedAt = this.scheduler.now();
    try {
      for (let index = 0; index < count; index++) {
        this.stepOnce(startedAt);
        if (this.scheduler.now() - startedAt > this.cpuBudgetMs) {
          this.lastWorkMs = Math.max(0, this.scheduler.now() - startedAt);
          this.fail(`Step paused because its work exceeded the ${this.cpuBudgetMs} ms CPU budget.`);
          return;
        }
        if (this.simulation.frame.terminated) break;
      }
      this.lastWorkMs = Math.max(0, this.scheduler.now() - startedAt);
      this.status = this.simulation.frame.terminated ? "completed" : "paused";
      this.publish();
    } catch (error) {
      this.fail(this.errorMessage(error, "Simulation step failed."));
    }
  }

  private stepOnce(startedAt: number): void {
    const simulation = this.simulation;
    if (!simulation) throw new Error("Simulation is unavailable.");
    const frame = simulation.step(1);
    this.addSample(frame, frame.terminated);
    this.lastWorkMs = Math.max(0, this.scheduler.now() - startedAt);
  }

  private reset(): void {
    const simulation = this.simulation;
    const project = this.project;
    if (!simulation || !project) return;
    try {
      const frame = simulation.reset();
      this.samples = [];
      this.effectiveSampleEvery = project.simulation.sampleEvery;
      this.addSample(frame, true);
      this.status = "paused";
      this.error = null;
      this.lastWorkMs = 0;
      this.publish();
    } catch (error) {
      this.fail(this.errorMessage(error, "Simulation reset failed."));
    }
  }

  private seek(targetStep: number, requestId: number, token: number): void {
    const simulation = this.simulation;
    const project = this.project;
    if (!simulation || !project) return;
    const maximumSteps = Math.min(PHYSICS_MAX_TOTAL_STEPS, Math.ceil(project.simulation.duration / project.simulation.fixedTimeStep));
    if (targetStep > maximumSteps) {
      this.fail(`Seek target exceeds the project's ${maximumSteps}-step limit.`);
      return;
    }
    try {
      const initial = simulation.reset();
      this.samples = [];
      this.effectiveSampleEvery = project.simulation.sampleEvery;
      this.addSample(initial, true);
      this.status = "paused";
      this.error = null;
      this.publish(requestId);
      let replayed = 0;

      const processChunk = () => {
        if (this.disposed || token !== this.generation || requestId !== this.activeRequestId) return;
        const startedAt = this.scheduler.now();
        const chunkLimit = Math.min(project.simulation.maximumSubsteps, PHYSICS_RUNTIME_MAX_SEEK_CHUNK);
        let chunkSteps = 0;
        try {
          while (replayed < targetStep && chunkSteps < chunkLimit && !simulation.frame.terminated
              && (chunkSteps === 0 || this.scheduler.now() - startedAt < this.cpuBudgetMs / 2)) {
            this.stepOnce(startedAt);
            replayed++;
            chunkSteps++;
            const elapsedMs = Math.max(0, this.scheduler.now() - startedAt);
            this.lastWorkMs = elapsedMs;
            if (elapsedMs > this.cpuBudgetMs) {
              this.fail(`Seek paused because a replay chunk exceeded the ${this.cpuBudgetMs} ms CPU budget.`);
              return;
            }
          }
          this.lastWorkMs = Math.max(0, this.scheduler.now() - startedAt);
          this.status = simulation.frame.terminated ? "completed" : "paused";
          this.publish(requestId);
          if (replayed < targetStep && !simulation.frame.terminated) {
            this.scheduled = this.scheduler.schedule(() => {
              this.scheduled = null;
              processChunk();
            }, 0);
          }
        } catch (error) {
          this.fail(this.errorMessage(error, "Seek replay failed."));
        }
      };
      if (targetStep === 0) return;
      this.scheduled = this.scheduler.schedule(() => {
        this.scheduled = null;
        processChunk();
      }, 0);
    } catch (error) {
      this.fail(this.errorMessage(error, "Could not reset before seeking."));
    }
  }

  private addSample(frame: SimulationFrame, force: boolean): void {
    if (!force && frame.step % this.effectiveSampleEvery !== 0) return;
    if (this.samples[this.samples.length - 1]?.step === frame.step) return;
    if (this.samples.length >= PHYSICS_MAX_SAMPLES) {
      const kept: SimulationFrame[] = [];
      for (let index = 0; index < this.samples.length; index += 2) kept.push(this.samples[index]);
      this.samples = kept;
      this.effectiveSampleEvery *= 2;
    }
    this.samples.push(frame);
  }

  private fail(message: string): void {
    this.cancelScheduledWork();
    this.status = "error";
    this.error = message.slice(0, 1_000);
    this.publish();
  }

  private cancelScheduledWork(): void {
    this.generation++;
    if (this.scheduled !== null) {
      this.scheduler.cancel(this.scheduled);
      this.scheduled = null;
    }
    this.lastTickAt = null;
  }

  private maximumSteps(): number {
    if (!this.project) return 0;
    return Math.min(PHYSICS_MAX_TOTAL_STEPS, Math.ceil(this.project.simulation.duration / this.project.simulation.fixedTimeStep));
  }

  private diagnostics(): PhysicsRuntimeDiagnostics {
    return {
      completedSteps: this.simulation?.frame.step ?? 0,
      maximumSteps: this.maximumSteps(),
      effectiveSampleEvery: this.effectiveSampleEvery,
      sampleCount: this.samples.length,
      lastWorkMs: this.lastWorkMs,
      lagEvents: this.lagEvents,
    };
  }

  private publish(requestId = this.activeRequestId): void {
    const sessionId = this.sessionId;
    if (sessionId === null || this.disposed) return;
    const response: PhysicsWorkerSnapshot = {
      protocolVersion: PHYSICS_WORKER_PROTOCOL_VERSION,
      sessionId,
      requestId,
      type: "snapshot",
      status: this.status,
      frame: this.simulation?.frame ?? null,
      samples: this.samples.slice(),
      error: this.error,
      diagnostics: this.diagnostics(),
    };
    this.emit(response);
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message.slice(0, 1_000) : fallback;
  }
}
