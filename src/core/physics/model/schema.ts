import { z } from "zod";

/** Portable Physics project inputs and scene coordinates use SI units. */
export const PHYSICS_PROJECT_SCHEMA_VERSION = 1 as const;
export const PHYSICS_JSON_MAX_BYTES = 256 * 1024;
export const PHYSICS_MAX_BATCH_STEPS = 10_000;
export const PHYSICS_MAX_TOTAL_STEPS = 1_000_000;

const bounded = (min: number, max: number) => z.number().finite().min(min).max(max);

const projectileParametersSchema = z.object({
  mass: bounded(1e-6, 1e6),
  gravity: bounded(0, 100),
  /** Linear drag coefficient b in F_drag = -b v; units kg/s. */
  drag: bounded(0, 1e6),
  initialX: bounded(-1e6, 1e6),
  initialY: bounded(0, 1e6),
  velocityX: bounded(-1e4, 1e4),
  velocityY: bounded(-1e4, 1e4),
}).strict();

const springParametersSchema = z.object({
  mass: bounded(1e-6, 1e6),
  stiffness: bounded(1e-6, 1e8),
  damping: bounded(0, 1e8),
  displacement: bounded(-1e6, 1e6),
  velocity: bounded(-1e4, 1e4),
}).strict();

const modelSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("projectile"), modelVersion: z.literal(1), parameters: projectileParametersSchema }).strict(),
  z.object({ kind: z.literal("spring"), modelVersion: z.literal(1), parameters: springParametersSchema }).strict(),
]);

const simulationSchema = z.object({
  fixedTimeStep: bounded(1e-4, 0.1),
  duration: bounded(0, 600),
  maximumSubsteps: z.number().int().min(1).max(PHYSICS_MAX_BATCH_STEPS),
  sampleEvery: z.number().int().min(1).max(PHYSICS_MAX_BATCH_STEPS),
  integrator: z.literal("symplectic-euler"),
  integratorVersion: z.literal(1),
}).strict();
export type SimulationConfig = z.infer<typeof simulationSchema>;

const sceneSchema = z.object({
  dimension: z.literal(2),
  coordinateFrame: z.literal("x-right-y-up"),
  camera: z.object({
    x: bounded(-1e6, 1e6),
    y: bounded(-1e6, 1e6),
    zoom: bounded(0.1, 8),
  }).strict(),
  showGrid: z.boolean(),
  showVectors: z.boolean(),
  showTrail: z.boolean(),
}).strict();
export type PhysicsScene = z.infer<typeof sceneSchema>;

const labReportSchema = z.object({
  hypothesis: z.string().max(8_000),
  notes: z.string().max(32_000),
  conclusion: z.string().max(8_000),
}).strict();

const projectBaseSchema = z.object({
  schemaVersion: z.literal(PHYSICS_PROJECT_SCHEMA_VERSION),
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  createdAt: z.number().finite().int().min(0).max(Number.MAX_SAFE_INTEGER),
  updatedAt: z.number().finite().int().min(0).max(Number.MAX_SAFE_INTEGER),
  unitPolicy: z.literal("SI"),
  model: modelSchema,
  simulation: simulationSchema,
  scene: sceneSchema,
  labReport: labReportSchema,
}).strict();

/**
 * Validate both field ranges and derived numerical safety before a project is
 * accepted. The step budget prevents imported projects from requesting an
 * unbounded synchronous simulation.
 */
export const physicsProjectSchema = projectBaseSchema.superRefine((project, context) => {
  if (project.updatedAt < project.createdAt) {
    context.addIssue({ code: "custom", path: ["updatedAt"], message: "updatedAt cannot precede createdAt" });
  }

  const steps = project.simulation.duration / project.simulation.fixedTimeStep;
  if (!Number.isFinite(steps) || steps > PHYSICS_MAX_TOTAL_STEPS) {
    context.addIssue({ code: "custom", path: ["simulation", "duration"], message: "Requested simulation exceeds the total step budget" });
  }

  const model = project.model;
  const h = project.simulation.fixedTimeStep;
  if (model.kind === "projectile") {
    const p = model.parameters;
    const dragRate = p.drag / p.mass;
    const initialAcceleration = Math.hypot(
      dragRate * p.velocityX,
      p.gravity + dragRate * p.velocityY,
    );
    if (dragRate * h > 0.5) {
      context.addIssue({ code: "custom", path: ["model", "parameters", "drag"], message: "Drag is too stiff for the selected fixed time step" });
    }
    if (!Number.isFinite(initialAcceleration) || initialAcceleration > 1e6) {
      context.addIssue({ code: "custom", path: ["model", "parameters"], message: "Initial acceleration exceeds the safe simulation range" });
    }
  } else {
    const p = model.parameters;
    const naturalFrequency = Math.sqrt(p.stiffness / p.mass);
    const dampingRate = p.damping / p.mass;
    const initialAcceleration = Math.abs((p.stiffness * p.displacement + p.damping * p.velocity) / p.mass);
    // Symplectic Euler is stable for hω < 2; 0.5 retains useful phase and
    // amplitude accuracy for the interactive teaching experiments.
    if (h * naturalFrequency > 0.5) {
      context.addIssue({ code: "custom", path: ["model", "parameters", "stiffness"], message: "Spring frequency is too high for the selected fixed time step" });
    }
    if (h * dampingRate > 0.5) {
      context.addIssue({ code: "custom", path: ["model", "parameters", "damping"], message: "Damping is too stiff for the selected fixed time step" });
    }
    if (!Number.isFinite(initialAcceleration) || initialAcceleration > 1e6) {
      context.addIssue({ code: "custom", path: ["model", "parameters"], message: "Initial acceleration exceeds the safe simulation range" });
    }
  }
});

export type PhysicsProject = z.infer<typeof physicsProjectSchema>;
export type PhysicsModel = PhysicsProject["model"];
export type ProjectileModel = Extract<PhysicsModel, { kind: "projectile" }>;
export type SpringModel = Extract<PhysicsModel, { kind: "spring" }>;

export function parsePhysicsProject(value: unknown): PhysicsProject | null {
  const result = physicsProjectSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Parse bounded JSON and reject malformed, oversized, and future-version data. */
export function parsePhysicsProjectJSON(text: string): PhysicsProject | null {
  if (typeof text !== "string" || text.length > PHYSICS_JSON_MAX_BYTES) return null;
  try {
    if (new TextEncoder().encode(text).byteLength > PHYSICS_JSON_MAX_BYTES) return null;
    return parsePhysicsProject(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export function createPhysicsProject(
  kind: "projectile" | "spring",
  id = `physics-${kind}`,
  now = Date.now(),
): PhysicsProject {
  const common = {
    schemaVersion: PHYSICS_PROJECT_SCHEMA_VERSION,
    id,
    name: kind === "projectile" ? "Projectile Motion" : "Mass–Spring Oscillator",
    createdAt: now,
    updatedAt: now,
    unitPolicy: "SI" as const,
    simulation: {
      fixedTimeStep: 1 / 120,
      duration: 10,
      maximumSubsteps: 1_000,
      sampleEvery: 1,
      integrator: "symplectic-euler" as const,
      integratorVersion: 1 as const,
    },
    scene: {
      dimension: 2 as const,
      coordinateFrame: "x-right-y-up" as const,
      camera: { x: 0, y: 0, zoom: 1 },
      showGrid: true,
      showVectors: true,
      showTrail: true,
    },
    labReport: { hypothesis: "", notes: "", conclusion: "" },
  };

  return physicsProjectSchema.parse({
    ...common,
    model: kind === "projectile"
      ? { kind, modelVersion: 1, parameters: { mass: 1, gravity: 9.81, drag: 0, initialX: 0, initialY: 0, velocityX: 10, velocityY: 15 } }
      : { kind, modelVersion: 1, parameters: { mass: 1, stiffness: 4, damping: 0.2, displacement: 1, velocity: 0 } },
  });
}
