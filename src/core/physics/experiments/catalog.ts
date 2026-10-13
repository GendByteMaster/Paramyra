import { createPhysicsProject, type PhysicsProject, type ProjectileModel, type SpringModel } from "../model/schema";
import type { UnitSymbol } from "../units";

export type PhysicsExperimentKind = PhysicsProject["model"]["kind"];

export type PhysicsExperiment = Readonly<{
  id: PhysicsExperimentKind;
  modelVersion: 1;
  category: "Mechanics";
  complexity: "beginner";
  title: string;
  summary: string;
  phenomenon: string;
  learningObjectives: readonly string[];
  governingEquations: readonly string[];
  assumptions: readonly string[];
  excludedEffects: readonly string[];
  parameters: readonly Readonly<{
    key: string;
    unit: UnitSymbol;
    minimum: number;
    maximum: number;
    defaultValue: number;
  }>[];
  referenceCases: readonly PhysicsReferenceCase[];
  observables: readonly string[];
  createProject(id?: string, now?: number): PhysicsProject;
}>;

export type PhysicsReferenceCase = Readonly<{
  id: string;
  title: string;
  modelKind: PhysicsExperimentKind;
  parameters: Readonly<Record<string, number>>;
  sampleTime: number;
  expected: Readonly<Record<string, number>>;
  absoluteTolerance: number;
  method: string;
}>;

const projectileParameters: readonly PhysicsExperiment["parameters"][number][] = Object.freeze([
  { key: "mass", unit: "kg", minimum: 1e-6, maximum: 1e6, defaultValue: 1 },
  { key: "gravity", unit: "m/s²", minimum: 0, maximum: 100, defaultValue: 9.81 },
  { key: "drag", unit: "kg/s", minimum: 0, maximum: 1e6, defaultValue: 0 },
  { key: "initialX", unit: "m", minimum: -1e6, maximum: 1e6, defaultValue: 0 },
  { key: "initialY", unit: "m", minimum: 0, maximum: 1e6, defaultValue: 0 },
  { key: "velocityX", unit: "m/s", minimum: -1e4, maximum: 1e4, defaultValue: 10 },
  { key: "velocityY", unit: "m/s", minimum: -1e4, maximum: 1e4, defaultValue: 15 },
]);

const springParameters: readonly PhysicsExperiment["parameters"][number][] = Object.freeze([
  { key: "mass", unit: "kg", minimum: 1e-6, maximum: 1e6, defaultValue: 1 },
  { key: "stiffness", unit: "N/m", minimum: 1e-6, maximum: 1e8, defaultValue: 4 },
  { key: "damping", unit: "kg/s", minimum: 0, maximum: 1e8, defaultValue: 0.2 },
  { key: "displacement", unit: "m", minimum: -1e6, maximum: 1e6, defaultValue: 1 },
  { key: "velocity", unit: "m/s", minimum: -1e4, maximum: 1e4, defaultValue: 0 },
]);

export const PHYSICS_EXPERIMENTS: readonly PhysicsExperiment[] = Object.freeze([
  Object.freeze({
    id: "projectile" as const,
    modelVersion: 1 as const,
    category: "Mechanics" as const,
    complexity: "beginner" as const,
    title: "Projectile Motion",
    summary: "Explore how launch conditions, gravity, and linear drag shape a two-dimensional trajectory.",
    phenomenon: "A point mass moves in a uniform gravitational field above a flat ground plane.",
    learningObjectives: Object.freeze([
      "Separate horizontal and vertical motion under uniform gravity.",
      "Compare the ideal trajectory with motion under linear velocity-dependent drag.",
      "Measure flight time, impact speed, and mechanical energy.",
    ]),
    governingEquations: Object.freeze([
      "F = (−b vₓ, −m g − b vᵧ)",
      "a = F / m",
      "K = ½ m (vₓ² + vᵧ²)",
      "U = m g y",
    ]),
    assumptions: Object.freeze([
      "The projectile is a point mass in a uniform gravitational field.",
      "Linear drag is isotropic and proportional to velocity: F_drag = -b v.",
      "Ground is a fixed horizontal plane at y = 0; contact ends the experiment.",
    ]),
    excludedEffects: Object.freeze(["Lift and spin", "Changing air density", "Variable gravity", "Impact and bounce response", "Wind" ]),
    parameters: projectileParameters,
    referenceCases: Object.freeze([Object.freeze({
      id: "ideal-launch-10-10",
      title: "Ideal launch at 10 m/s in each direction",
      modelKind: "projectile" as const,
      parameters: Object.freeze({ mass: 1, gravity: 9.81, drag: 0, initialY: 0, velocityX: 10, velocityY: 10 }),
      sampleTime: 2.03873598369,
      expected: Object.freeze({ flightTime: 2.03873598369, range: 20.3873598369, peakHeight: 5.09683995922 }),
      absoluteTolerance: 0.01,
      method: "Analytical vacuum trajectory: t_f = 2 v_y / g, R = v_x t_f, H = v_y² / (2g).",
    })]),
    observables: Object.freeze(["position", "velocity", "acceleration", "net force", "kinetic energy", "potential energy"]),
    createProject: (id?: string, now?: number) => createPhysicsProject("projectile", id, now),
  }),
  Object.freeze({
    id: "spring" as const,
    modelVersion: 1 as const,
    category: "Mechanics" as const,
    complexity: "beginner" as const,
    title: "Mass–Spring Oscillator",
    summary: "Study free oscillation and damping of a mass attached to a linear spring.",
    phenomenon: "A point mass moves along one axis under Hooke restoring force and viscous damping.",
    learningObjectives: Object.freeze([
      "Relate mass and stiffness to the natural angular frequency.",
      "Observe how viscous damping reduces the oscillation amplitude.",
      "Track kinetic, elastic potential, and total mechanical energy.",
    ]),
    governingEquations: Object.freeze([
      "F = −k x − c v",
      "ω₀ = √(k / m)",
      "K = ½ m v²",
      "U = ½ k x²",
    ]),
    assumptions: Object.freeze([
      "A point mass moves in one dimension under a massless linear spring.",
      "Damping force is viscous and proportional to velocity: F_d = -c v.",
      "The spring equilibrium is at x = 0 and has constant stiffness.",
    ]),
    excludedEffects: Object.freeze(["Nonlinear stiffness", "External driving", "Spring mass", "Coulomb friction", "Motion outside one dimension"]),
    parameters: springParameters,
    referenceCases: Object.freeze([
      Object.freeze({
        id: "undamped-natural-period",
        title: "Undamped oscillator at quarter period",
        modelKind: "spring" as const,
        parameters: Object.freeze({ mass: 1, stiffness: 4, damping: 0, displacement: 1, velocity: 0 }),
        sampleTime: Math.PI / 4,
        expected: Object.freeze({ displacement: 0, velocity: -2, totalEnergy: 2 }),
        absoluteTolerance: 0.01,
        method: "Analytical solution x(t)=x₀ cos(ω₀t), ω₀=√(k/m); energy is conserved when c=0.",
      }),
      Object.freeze({
        id: "underdamped-decay-at-one-second",
        title: "Underdamped displacement after one second",
        modelKind: "spring" as const,
        parameters: Object.freeze({ mass: 1, stiffness: 4, damping: 0.4, displacement: 1, velocity: 0.3 }),
        sampleTime: 1,
        expected: Object.freeze({ displacement: -0.1453279381206481 }),
        absoluteTolerance: 0.002,
        method: "Underdamped closed-form oscillator solution with ω_d=√(k/m−(c/2m)²).",
      }),
    ]),
    observables: Object.freeze(["position", "velocity", "acceleration", "net force", "kinetic energy", "potential energy"]),
    createProject: (id?: string, now?: number) => createPhysicsProject("spring", id, now),
  }),
]);

export function getPhysicsExperiment(kind: PhysicsExperimentKind): PhysicsExperiment {
  const experiment = PHYSICS_EXPERIMENTS.find((entry) => entry.id === kind);
  if (!experiment) throw new RangeError(`Unknown physics experiment: ${kind}`);
  return experiment;
}

export type ExperimentProjectileParameters = ProjectileModel["parameters"];
export type ExperimentSpringParameters = SpringModel["parameters"];
