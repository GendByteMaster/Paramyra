import { describe, expect, it } from "vitest";
import { createPhysicsProject, parsePhysicsProject, type PhysicsProject } from "../model/schema";
import { PhysicsSimulation } from "./simulation";

function projectile(overrides: Partial<Extract<PhysicsProject["model"], { kind: "projectile" }>['parameters']> = {}, simulationOverrides: Partial<PhysicsProject["simulation"]> = {}): PhysicsProject {
  const base = createPhysicsProject("projectile", "projectile-test", 100);
  if (base.model.kind !== "projectile") throw new Error("Expected projectile defaults");
  const project = parsePhysicsProject({
    ...base,
    model: { ...base.model, parameters: { ...base.model.parameters, ...overrides } },
    simulation: { ...base.simulation, ...simulationOverrides },
  });
  if (!project) throw new Error("Test projectile is outside the valid PhysicsProject range");
  return project;
}

function spring(overrides: Partial<Extract<PhysicsProject["model"], { kind: "spring" }>['parameters']> = {}, simulationOverrides: Partial<PhysicsProject["simulation"]> = {}): PhysicsProject {
  const base = createPhysicsProject("spring", "spring-test", 100);
  if (base.model.kind !== "spring") throw new Error("Expected spring defaults");
  const project = parsePhysicsProject({
    ...base,
    model: { ...base.model, parameters: { ...base.model.parameters, ...overrides } },
    simulation: { ...base.simulation, ...simulationOverrides },
  });
  if (!project) throw new Error("Test spring is outside the valid PhysicsProject range");
  return project;
}

describe("PhysicsSimulation", () => {
  it("matches no-drag projectile kinematics within first-order symplectic Euler error", () => {
    const h = 0.001;
    const sim = new PhysicsSimulation(projectile({ velocityX: 10, velocityY: 10, gravity: 9.81 }, {
      fixedTimeStep: h,
      duration: 1,
      maximumSubsteps: 1_000,
    }));
    const frame = sim.step(1_000);

    expect(frame.time).toBe(1);
    expect(frame.position.x).toBeCloseTo(10, 10);
    // Velocity-first Euler uses y_n = y_0 + v_0 t - g(t² + h t)/2.
    expect(frame.position.y).toBeCloseTo(10 - 9.81 * (1 + h) / 2, 7);
    expect(frame.velocity.y).toBeCloseTo(10 - 9.81, 10);
    expect(frame.force.y).toBeCloseTo(-9.81, 10);
    expect(frame.acceleration.y).toBeCloseTo(-9.81, 10);
    expect(frame.kineticEnergy).toBeGreaterThan(0);
    expect(frame.potentialEnergy).toBeGreaterThan(0);
    expect(frame.totalEnergy).toBe(frame.kineticEnergy + frame.potentialEnergy);
  });

  it("matches the linear-drag closed form within the integrator's first-order error", () => {
    const b = 2;
    const h = 0.001;
    const t = 1;
    const exactVelocity = 10 * Math.exp(-b * t);
    const exactPosition = 10 * (1 - Math.exp(-b * t)) / b;
    const run = (step: number, count: number) => new PhysicsSimulation(projectile({
      mass: 1,
      drag: b,
      gravity: 0,
      velocityX: 10,
      velocityY: 0,
      initialY: 10,
    }, {
      fixedTimeStep: step,
      duration: t,
      maximumSubsteps: count,
    })).step(count);
    const frame = run(h, 1_000);
    const refined = run(h / 2, 2_000);
    // For vₙ = (1-βh)ⁿv₀ and xₙ₊₁ = xₙ + h vₙ₊₁, the discrete
    // trajectory has this exact closed form; comparing it to the continuous
    // solution makes the truncation tolerance explicit.
    const ratio = 1 - b * h;
    const discreteVelocity = 10 * ratio ** 1_000;
    const discretePosition = 10 * h * ratio * (1 - ratio ** 1_000) / (1 - ratio);

    const coarseError = Math.abs(frame.position.x - exactPosition);
    const refinedError = Math.abs(refined.position.x - exactPosition);
    expect(frame.velocity.x).toBeCloseTo(discreteVelocity, 10);
    expect(frame.position.x).toBeCloseTo(discretePosition, 10);
    expect(Math.abs(frame.velocity.x - exactVelocity)).toBeCloseTo(Math.abs(discreteVelocity - exactVelocity), 9);
    expect(coarseError).toBeCloseTo(Math.abs(discretePosition - exactPosition), 9);
    expect(refinedError).toBeLessThan(coarseError * 0.6);
  });

  it("interpolates projectile ground contact inside a step and never returns below ground", () => {
    const h = 0.005;
    const sim = new PhysicsSimulation(projectile({ initialX: 2, initialY: 1, velocityX: 5, velocityY: 10 }, {
      fixedTimeStep: h,
      duration: 5,
      maximumSubsteps: 1_000,
    }));
    const frame = sim.step(1_000);
    const exactFlightTime = (10 + Math.sqrt(100 + 2 * 9.81)) / 9.81;

    expect(frame.terminated).toBe(true);
    expect(frame.terminationReason).toBe("ground-contact");
    expect(frame.position.y).toBe(0);
    expect(frame.velocity.y).toBeLessThan(0);
    expect(frame.time).toBeLessThan(frame.step * h);
    expect(frame.time).toBeCloseTo(exactFlightTime, 1);
    expect(frame.position.x).toBeGreaterThan(2);
    expect(sim.step().time).toBe(frame.time);
  });

  it("terminates a low upward launch that returns to ground within its first step", () => {
    const sim = new PhysicsSimulation(projectile({ initialY: 0, velocityY: 0.01 }, {
      fixedTimeStep: 0.01,
      duration: 1,
    }));
    const frame = sim.step();

    expect(frame.terminated).toBe(true);
    expect(frame.terminationReason).toBe("ground-contact");
    expect(frame.position.y).toBe(0);
    expect(Math.abs(frame.velocity.y)).toBeLessThan(1e-15);
    expect(frame.time).toBeGreaterThan(0);
    expect(frame.time).toBeLessThan(0.01);
    expect(frame.time).toBeCloseTo(0.01 / 9.81, 12);
  });

  it("localizes contact consistently with the partial symplectic step and converges to ballistic impact", () => {
    const run = (h: number) => new PhysicsSimulation(projectile({ initialY: 0.15, velocityY: -0.8, velocityX: 3 }, {
      fixedTimeStep: h, duration: 1,
    })).step(1_000);
    const coarse = run(0.1);
    const localRoot = (-0.8 + Math.sqrt(0.8 ** 2 + 4 * 9.81 * 0.15)) / (2 * 9.81);
    const exactImpact = (-0.8 + Math.sqrt(0.8 ** 2 + 2 * 9.81 * 0.15)) / 9.81;
    expect(coarse.time).toBeCloseTo(localRoot, 12);
    expect(0.15 - 0.8 * coarse.time - 9.81 * coarse.time ** 2).toBeCloseTo(0, 12);
    expect(coarse.position.x).toBeCloseTo(3 * coarse.time, 12);
    expect(coarse.velocity.y).toBeCloseTo(-0.8 - 9.81 * coarse.time, 12);
    expect(Math.abs(run(0.001).time - exactImpact)).toBeLessThan(Math.abs(coarse.time - exactImpact) / 20);
  });

  it("keeps undamped oscillator energy bounded and converges as the fixed step shrinks", () => {
    const project = spring({ mass: 1, stiffness: 4, damping: 0, displacement: 1, velocity: 0 }, {
      fixedTimeStep: 1 / 120,
      duration: 10,
      maximumSubsteps: 1_000,
    });
    const sim = new PhysicsSimulation(project);
    const startEnergy = sim.frame.totalEnergy;
    let maximumEnergy = startEnergy;
    for (let i = 0; i < 1_000; i++) maximumEnergy = Math.max(maximumEnergy, sim.step().totalEnergy);
    expect(startEnergy).toBeCloseTo(2);
    expect(maximumEnergy - startEnergy).toBeLessThan(0.04);

    const errorAt = (h: number) => {
      const duration = 0.4;
      const frame = new PhysicsSimulation(spring({ displacement: 1, velocity: 0.3, damping: 0 }, {
        fixedTimeStep: h,
        duration,
        maximumSubsteps: 1_000,
      })).step(Math.round(duration / h));
      const exact = Math.cos(2 * duration) + 0.15 * Math.sin(2 * duration);
      return Math.abs(frame.position.x - exact);
    };
    expect(errorAt(0.01)).toBeLessThan(errorAt(0.02) * 0.65);
  });

  it("matches the underdamped oscillator analytical solution", () => {
    const m = 1;
    const k = 4;
    const c = 0.4;
    const h = 0.0005;
    const t = 1;
    const x0 = 1;
    const v0 = 0.3;
    const omega0 = Math.sqrt(k / m);
    const decay = c / (2 * m);
    const omegaD = Math.sqrt(omega0 ** 2 - decay ** 2);
    const exact = Math.exp(-decay * t) * (
      x0 * Math.cos(omegaD * t) + (v0 + decay * x0) / omegaD * Math.sin(omegaD * t)
    );
    const frame = new PhysicsSimulation(spring({ mass: m, stiffness: k, damping: c, displacement: x0, velocity: v0 }, {
      fixedTimeStep: h,
      duration: t,
      maximumSubsteps: 2_000,
    })).step(2_000);

    expect(frame.position.x).toBeCloseTo(exact, 3);
    expect(frame.totalEnergy).toBeLessThan(2);
  });

  it("replays deterministically, resets exactly, and bounds batch requests", () => {
    const project = spring({ damping: 0.2 }, { maximumSubsteps: 20 });
    const first = new PhysicsSimulation(project);
    const second = new PhysicsSimulation(project);
    expect(Object.isFrozen(first.project.model.parameters)).toBe(true);
    expect(first.step(20)).toEqual(second.step(20));
    expect(first.reset()).toEqual(new PhysicsSimulation(project).frame);
    expect(() => first.step(0)).toThrow(RangeError);
    expect(() => first.step(21)).toThrow(RangeError);
    expect(() => new PhysicsSimulation({ ...project, schemaVersion: 99 } as unknown as PhysicsProject)).toThrow(TypeError);
  });
});
