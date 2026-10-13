import { parsePhysicsProject, type PhysicsProject } from "../model/schema";
import {
  fromSI,
  forceFromMassAcceleration,
  gravitationalPotentialEnergy,
  kineticEnergyFromMassVelocity,
  multiply,
  springPotentialEnergy,
} from "../units";

export type Vector2 = Readonly<{ x: number; y: number }>;

export type TerminationReason = "ground-contact" | "duration";

export type SimulationFrame = Readonly<{
  /** Number of integration intervals attempted; remains an integer at impact. */
  step: number;
  /** Elapsed SI seconds. Ground impact may occur between integer step times. */
  time: number;
  position: Vector2;
  velocity: Vector2;
  acceleration: Vector2;
  force: Vector2;
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  terminated: boolean;
  terminationReason?: TerminationReason;
}>;

type MutableState = {
  step: number;
  time: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  force: { x: number; y: number };
  kineticEnergy: number;
  potentialEnergy: number;
  terminated: boolean;
  terminationReason?: TerminationReason;
};

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`Simulation produced a non-finite ${label}`);
  return value;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function freezeVector(x: number, y: number): Vector2 {
  return Object.freeze({ x: finite(x, "vector component"), y: finite(y, "vector component") });
}

function freezeFrame(state: MutableState): SimulationFrame {
  const kineticEnergy = finite(state.kineticEnergy, "kinetic energy");
  const potentialEnergy = finite(state.potentialEnergy, "potential energy");
  return Object.freeze({
    step: state.step,
    time: finite(state.time, "time"),
    position: freezeVector(state.position.x, state.position.y),
    velocity: freezeVector(state.velocity.x, state.velocity.y),
    acceleration: freezeVector(state.acceleration.x, state.acceleration.y),
    force: freezeVector(state.force.x, state.force.y),
    kineticEnergy,
    potentialEnergy,
    totalEnergy: finite(kineticEnergy + potentialEnergy, "total energy"),
    terminated: state.terminated,
    ...(state.terminationReason ? { terminationReason: state.terminationReason } : {}),
  });
}

function projectileForces(project: Extract<PhysicsProject["model"], { kind: "projectile" }>, velocity: Vector2): Vector2 {
  const p = project.parameters;
  const mass = fromSI(p.mass, "mass");
  const gravity = fromSI(-p.gravity, "acceleration");
  const drag = fromSI(p.drag, "dampingCoefficient");
  const dragX = multiply(drag, fromSI(velocity.x, "velocity")).value;
  const dragY = multiply(drag, fromSI(velocity.y, "velocity")).value;
  const weight = forceFromMassAcceleration(mass, gravity).value;
  return freezeVector(-dragX, weight - dragY);
}

function springForces(project: Extract<PhysicsProject["model"], { kind: "spring" }>, velocityX: number, displacement: number): Vector2 {
  const p = project.parameters;
  const stiffnessForce = multiply(fromSI(p.stiffness, "springConstant"), fromSI(displacement, "length")).value;
  const dampingForce = multiply(fromSI(p.damping, "dampingCoefficient"), fromSI(velocityX, "velocity")).value;
  return freezeVector(-stiffnessForce - dampingForce, 0);
}

/**
 * Framework-independent deterministic fixed-step mechanics engine.
 * Symplectic Euler updates velocity before position. A shorter final interval
 * is used only when project duration is not divisible by its fixed step.
 */
export class PhysicsSimulation {
  readonly project: PhysicsProject;
  private state: MutableState;

  constructor(project: PhysicsProject) {
    const validated = parsePhysicsProject(project);
    if (!validated) throw new TypeError("PhysicsSimulation requires a valid version 1 PhysicsProject");
    this.project = deepFreeze(validated);
    this.state = this.initialState();
    this.refreshDerivedState(this.state);
    if (this.project.simulation.duration === 0) this.terminate("duration");
    if (!this.state.terminated && this.project.model.kind === "projectile" && this.state.position.y === 0 && this.state.velocity.y <= 0) {
      this.terminate("ground-contact");
    }
  }

  get frame(): SimulationFrame {
    return freezeFrame(this.state);
  }

  /** Advance up to `count` fixed integration intervals; batches are bounded by the project. */
  step(count = 1): SimulationFrame {
    if (!Number.isInteger(count) || count < 1 || count > this.project.simulation.maximumSubsteps) {
      throw new RangeError(`count must be an integer from 1 to ${this.project.simulation.maximumSubsteps}`);
    }
    for (let index = 0; index < count && !this.state.terminated; index++) this.integrateOneStep();
    return this.frame;
  }

  reset(): SimulationFrame {
    this.state = this.initialState();
    this.refreshDerivedState(this.state);
    if (this.project.simulation.duration === 0) this.terminate("duration");
    if (!this.state.terminated && this.project.model.kind === "projectile" && this.state.position.y === 0 && this.state.velocity.y <= 0) {
      this.terminate("ground-contact");
    }
    return this.frame;
  }

  private initialState(): MutableState {
    const initial = this.project.model.kind === "projectile"
      ? {
          position: { x: this.project.model.parameters.initialX, y: this.project.model.parameters.initialY },
          velocity: { x: this.project.model.parameters.velocityX, y: this.project.model.parameters.velocityY },
        }
      : {
          position: { x: this.project.model.parameters.displacement, y: 0 },
          velocity: { x: this.project.model.parameters.velocity, y: 0 },
        };
    return {
      step: 0,
      time: 0,
      ...initial,
      acceleration: { x: 0, y: 0 },
      force: { x: 0, y: 0 },
      kineticEnergy: 0,
      potentialEnergy: 0,
      terminated: false,
    };
  }

  private terminate(reason: TerminationReason): void {
    this.state.terminated = true;
    this.state.terminationReason = reason;
  }

  private integrateOneStep(): void {
    const { state } = this;
    const { fixedTimeStep, duration } = this.project.simulation;
    if (state.time >= duration) {
      this.terminate("duration");
      return;
    }
    const remaining = duration - state.time;
    const h = Math.min(fixedTimeStep, remaining);
    const previousY = state.position.y;
    const previousX = state.position.x;
    const previousVx = state.velocity.x;
    const previousVy = state.velocity.y;

    const force = this.project.model.kind === "projectile"
      ? projectileForces(this.project.model, state.velocity)
      : springForces(this.project.model, previousVx, previousX);
    const mass = this.project.model.parameters.mass;
    const acceleration = freezeVector(force.x / mass, force.y / mass);
    const velocity = freezeVector(previousVx + acceleration.x * h, previousVy + acceleration.y * h);
    const candidatePosition = freezeVector(previousX + velocity.x * h, previousY + velocity.y * h);

    state.step += 1;
    const stepEndTime = Math.min(state.step * fixedTimeStep, duration);
    if (this.project.model.kind === "projectile" && previousY >= 0 && candidatePosition.y <= 0) {
      // Use the same partial symplectic step as the crossed endpoint:
      // y(t) = y0 + (vy0 + ay*t)*t. This is first-order dense output,
      // not the exact continuous ballistic trajectory. The stable quadratic
      // formula avoids cancellation for very small positive impact times.
      const ay = acceleration.y;
      const discriminant = previousVy ** 2 - 4 * ay * previousY;
      const q = -0.5 * (previousVy + (previousVy < 0 ? -1 : 1) * Math.sqrt(Math.max(0, discriminant)));
      const roots = ay === 0 ? [-previousY / previousVy] : [q / ay, q === 0 ? 0 : previousY / q];
      const elapsed = roots.filter(t => t > 0 && t <= h * (1 + 1e-12)).sort((a, b) => a - b)[0];
      if (elapsed === undefined) throw new RangeError("Could not localize ground contact inside the integration interval");
      state.position = {
        x: previousX + (previousVx + acceleration.x * elapsed) * elapsed,
        y: 0,
      };
      state.velocity = {
        x: previousVx + acceleration.x * elapsed,
        y: previousVy + acceleration.y * elapsed,
      };
      state.time += elapsed;
      this.refreshDerivedState(state);
      this.terminate("ground-contact");
      return;
    }

    state.position = { ...candidatePosition };
    state.velocity = { ...velocity };
    state.time = stepEndTime;
    this.refreshDerivedState(state);
    if (state.time >= duration) this.terminate("duration");
  }

  private refreshDerivedState(state: MutableState): void {
    const model = this.project.model;
    const force = model.kind === "projectile"
      ? projectileForces(model, state.velocity)
      : springForces(model, state.velocity.x, state.position.x);
    state.force = { ...force };
    state.acceleration = { x: force.x / model.parameters.mass, y: force.y / model.parameters.mass };

    const mass = fromSI(model.parameters.mass, "mass");
    const speedSquared = state.velocity.x ** 2 + state.velocity.y ** 2;
    const speed = Math.sqrt(speedSquared);
    state.kineticEnergy = kineticEnergyFromMassVelocity(mass, fromSI(speed, "velocity")).value;
    state.potentialEnergy = model.kind === "projectile"
      ? gravitationalPotentialEnergy(
          mass,
          fromSI(model.parameters.gravity, "acceleration"),
          fromSI(state.position.y, "length"),
        ).value
      : springPotentialEnergy(
          fromSI(model.parameters.stiffness, "springConstant"),
          fromSI(state.position.x, "length"),
        ).value;
    finite(state.acceleration.x, "acceleration");
    finite(state.acceleration.y, "acceleration");
    finite(state.kineticEnergy, "kinetic energy");
    finite(state.potentialEnergy, "potential energy");
  }
}
