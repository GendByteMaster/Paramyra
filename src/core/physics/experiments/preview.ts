import { PhysicsSimulation, type SimulationFrame } from "../engine/simulation";
import { getPhysicsExperiment } from "./catalog";
import type { PhysicsProject } from "../model/schema";

export const PHYSICS_PREVIEW_STEP_LIMIT = 1_200;

export type PhysicsPreview = Readonly<{
  project: PhysicsProject;
  frames: readonly SimulationFrame[];
  stepCount: number;
  reachedStepLimit: boolean;
}>;

export type ProjectilePreview = PhysicsPreview & Readonly<{
  apex: SimulationFrame;
  launchSpeed: number;
  flightTime: number;
  horizontalRange: number;
}>;

/**
 * Build a bounded, deterministic sample series using the production solver.
 * Each call advances one fixed integration interval, so neither the requested
 * batch size nor the project's batch setting can exceed the preview budget.
 */
export function createPhysicsPreview(
  project: PhysicsProject,
  requestedStepLimit = PHYSICS_PREVIEW_STEP_LIMIT,
): PhysicsPreview {
  if (!Number.isSafeInteger(requestedStepLimit) || requestedStepLimit < 0) {
    throw new RangeError("Preview step limit must be a non-negative safe integer");
  }

  const simulation = new PhysicsSimulation(project);
  const stepLimit = Math.min(requestedStepLimit, PHYSICS_PREVIEW_STEP_LIMIT);
  const durationSteps = Math.ceil(project.simulation.duration / project.simulation.fixedTimeStep);
  const allowedSteps = Math.min(stepLimit, durationSteps);
  const frames: SimulationFrame[] = [simulation.frame];

  while (frames.length - 1 < allowedSteps && !frames[frames.length - 1].terminated) {
    frames.push(simulation.step(1));
  }

  const finalFrame = frames[frames.length - 1];
  return Object.freeze({
    project: simulation.project,
    frames: Object.freeze(frames),
    stepCount: frames.length - 1,
    reachedStepLimit: !finalFrame.terminated && frames.length - 1 >= stepLimit,
  });
}

/** Default home-page trajectory with a stable ID and timestamp. */
export function createDefaultProjectilePreview(): ProjectilePreview {
  const project = getPhysicsExperiment("projectile").createProject("physics-home-preview", 0);
  if (project.model.kind !== "projectile") throw new TypeError("Projectile catalogue entry returned the wrong model");

  const preview = createPhysicsPreview(project);
  const initial = preview.frames[0];
  const finalFrame = preview.frames[preview.frames.length - 1];
  const apex = preview.frames.reduce((highest, frame) => frame.position.y > highest.position.y ? frame : highest);
  const launchSpeed = Math.hypot(initial.velocity.x, initial.velocity.y);

  if (!Number.isFinite(launchSpeed) || !Number.isFinite(apex.time) || !Number.isFinite(finalFrame.time)) {
    throw new RangeError("Default projectile preview produced a non-finite metric");
  }

  return Object.freeze({
    ...preview,
    apex,
    launchSpeed,
    flightTime: finalFrame.time,
    horizontalRange: finalFrame.position.x - initial.position.x,
  });
}
