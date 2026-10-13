import { z } from "zod";
import { physicsProjectSchema, parsePhysicsProject, type PhysicsProject } from "../model/schema";
import type { SimulationFrame } from "../engine/simulation";

export const MAX_EXPORTED_SAMPLES = 2_048;
export const MAX_MEASUREMENTS_JSON_BYTES = 2 * 1024 * 1024;

const vector = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const sample = z.object({
  step: z.number().int().safe().nonnegative(),
  time: z.number().finite().nonnegative(),
  position: vector, velocity: vector, acceleration: vector, force: vector,
  kineticEnergy: z.number().finite().nonnegative(),
  potentialEnergy: z.number().finite(), totalEnergy: z.number().finite(),
  terminated: z.boolean(),
  terminationReason: z.enum(["ground-contact", "duration"]).optional(),
}).strict();

export const MEASUREMENT_UNITS = Object.freeze({
  time: "s", position: "m", velocity: "m/s", acceleration: "m/s²",
  force: "N", kineticEnergy: "J", potentialEnergy: "J", totalEnergy: "J",
} as const);

function approximately(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(actual), Math.abs(expected));
}

/** Structurally validated interchange, not certified proof of an engine run. */
export const physicsMeasurementsSchema = z.object({
  format: z.literal("paramyra.physics.measurements"),
  schemaVersion: z.literal(1),
  project: physicsProjectSchema,
  units: z.object({
    time: z.literal("s"), position: z.literal("m"), velocity: z.literal("m/s"),
    acceleration: z.literal("m/s²"), force: z.literal("N"),
    kineticEnergy: z.literal("J"), potentialEnergy: z.literal("J"), totalEnergy: z.literal("J"),
  }).strict(),
  samples: z.array(sample).max(MAX_EXPORTED_SAMPLES),
}).strict().superRefine((snapshot, context) => {
  let previousStep = -1;
  let previousTime = -1;
  let previousTerminated = false;
  const { model, simulation } = snapshot.project;
  const maximumStep = Math.ceil(simulation.duration / simulation.fixedTimeStep);
  for (const [index, frame] of snapshot.samples.entries()) {
    const issue = (message: string) => context.addIssue({ code: "custom", path: ["samples", index], message });
    if (frame.step <= previousStep || frame.time <= previousTime || previousTerminated ||
        frame.time > simulation.duration || frame.step > maximumStep) {
      context.addIssue({ code: "custom", path: ["samples", index], message: "Samples must be ordered and within the simulation budget" });
    }
    if (frame.terminated !== (frame.terminationReason !== undefined)) issue("Termination state and reason must agree");
    const stepEnd = Math.min(frame.step * simulation.fixedTimeStep, simulation.duration);
    if (frame.terminationReason === "ground-contact") {
      const start = Math.max(0, (frame.step - 1) * simulation.fixedTimeStep);
      if (model.kind !== "projectile" || frame.position.y !== 0 || frame.velocity.y > 1e-10 ||
          frame.time < start || frame.time > stepEnd) issue("Ground contact must lie inside its projectile integration interval");
    } else {
      if (!approximately(frame.time, stepEnd)) issue("Sample time must match its fixed integration step");
      if (frame.terminated !== approximately(frame.time, simulation.duration)) issue("Duration termination must agree with project duration");
    }
    const p = model.parameters;
    const fx = model.kind === "projectile" ? -model.parameters.drag * frame.velocity.x
      : -model.parameters.stiffness * frame.position.x - model.parameters.damping * frame.velocity.x;
    const fy = model.kind === "projectile" ? -p.mass * model.parameters.gravity - model.parameters.drag * frame.velocity.y : 0;
    const kinetic = 0.5 * p.mass * (frame.velocity.x ** 2 + frame.velocity.y ** 2);
    const potential = model.kind === "projectile" ? p.mass * model.parameters.gravity * frame.position.y
      : 0.5 * model.parameters.stiffness * frame.position.x ** 2;
    if (!approximately(frame.force.x, fx) || !approximately(frame.force.y, fy) ||
        !approximately(frame.acceleration.x, fx / p.mass) || !approximately(frame.acceleration.y, fy / p.mass) ||
        !approximately(frame.kineticEnergy, kinetic) || !approximately(frame.potentialEnergy, potential) ||
        !approximately(frame.totalEnergy, kinetic + potential)) issue("Derived measurements must agree with the embedded physical model");
    if (model.kind === "spring" && (frame.position.y !== 0 || frame.velocity.y !== 0)) issue("Spring measurements must stay on their one-dimensional axis");
    if (model.kind === "projectile" && frame.position.y < 0) issue("Projectile measurements cannot be below ground");
    if (frame.step === 0) {
      const initial = model.kind === "projectile"
        ? { x: model.parameters.initialX, y: model.parameters.initialY, vx: model.parameters.velocityX, vy: model.parameters.velocityY }
        : { x: model.parameters.displacement, y: 0, vx: model.parameters.velocity, vy: 0 };
      if (frame.time !== 0 || frame.position.x !== initial.x || frame.position.y !== initial.y ||
          frame.velocity.x !== initial.vx || frame.velocity.y !== initial.vy) issue("Initial sample must match the project initial conditions");
    }
    previousStep = frame.step;
    previousTime = frame.time;
    previousTerminated = frame.terminated;
  }
});

export type PhysicsMeasurements = z.infer<typeof physicsMeasurementsSchema>;

function snapshot(project: PhysicsProject, samples: readonly SimulationFrame[]): PhysicsMeasurements | null {
  const validProject = parsePhysicsProject(project);
  if (!validProject || samples.length > MAX_EXPORTED_SAMPLES) return null;
  const result = physicsMeasurementsSchema.safeParse({
    format: "paramyra.physics.measurements", schemaVersion: 1,
    project: validProject, units: MEASUREMENT_UNITS, samples,
  });
  return result.success ? result.data : null;
}

export function exportMeasurementsJSON(project: PhysicsProject, samples: readonly SimulationFrame[]): string | null {
  const valid = snapshot(project, samples);
  if (!valid) return null;
  const text = JSON.stringify(valid, null, 2);
  return new TextEncoder().encode(text).byteLength <= MAX_MEASUREMENTS_JSON_BYTES ? text : null;
}

export function parseMeasurementsJSON(text: string): PhysicsMeasurements | null {
  if (typeof text !== "string" || text.length > MAX_MEASUREMENTS_JSON_BYTES ||
      new TextEncoder().encode(text).byteLength > MAX_MEASUREMENTS_JSON_BYTES) return null;
  try {
    const result = physicsMeasurementsSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch { return null; }
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Comment rows carry provenance; data rows contain only finite numerical values. */
export function exportMeasurementsCSV(project: PhysicsProject, samples: readonly SimulationFrame[]): string | null {
  const valid = snapshot(project, samples);
  if (!valid) return null;
  const metadata = [
    ["# format", "paramyra.physics.measurements", "1"],
    ["# project", JSON.stringify({ id: valid.project.id, name: valid.project.name, schemaVersion: 1 })],
    ["# model", JSON.stringify(valid.project.model)],
    ["# simulation", JSON.stringify(valid.project.simulation)],
    ["# unitPolicy", "SI"],
  ].map(row => row.map(csvCell).join(","));
  const header = "step,time_s,x_m,y_m,vx_m_s,vy_m_s,ax_m_s2,ay_m_s2,fx_N,fy_N,kinetic_J,potential_J,total_J";
  const rows = valid.samples.map(frame => [
    frame.step, frame.time, frame.position.x, frame.position.y,
    frame.velocity.x, frame.velocity.y, frame.acceleration.x, frame.acceleration.y,
    frame.force.x, frame.force.y, frame.kineticEnergy, frame.potentialEnergy, frame.totalEnergy,
  ].join(","));
  return [...metadata, header, ...rows].join("\r\n") + "\r\n";
}
