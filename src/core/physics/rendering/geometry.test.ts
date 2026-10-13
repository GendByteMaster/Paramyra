import { describe, expect, it } from "vitest";
import { createPhysicsProject } from "../model/schema";
import type { SimulationFrame } from "../engine/simulation";
import {
  boundedPhysicsSamples,
  fitPhysicsCamera,
  physicsGridStep,
  physicsWorldBounds,
  screenToWorld,
  worldToScreen,
  zoomPhysicsAt,
  type PhysicsCamera,
} from "./geometry";
import { vectorPixelsPerUnit } from "./canvas";

const size = { width: 960, height: 640 };
const frame = (step: number, x: number, y: number, vx = 0, vy = 0, fx = 0, fy = 0): SimulationFrame => ({
  step,
  time: step / 120,
  position: { x, y },
  velocity: { x: vx, y: vy },
  acceleration: { x: 0, y: 0 },
  force: { x: fx, y: fy },
  kineticEnergy: 0.5,
  potentialEnergy: 0.5,
  totalEnergy: 1,
  terminated: false,
}) as SimulationFrame;

describe("Physics canvas world geometry", () => {
  it("round trips SI coordinates with +Y pointing upward", () => {
    const camera: PhysicsCamera = { x: 4, y: -2, zoom: 1.4 };
    const world = { x: 6.25, y: 3.75 };
    const screen = worldToScreen(world, size, camera);
    expect(screen.y).toBeLessThan(size.height / 2);
    const back = screenToWorld(screen, size, camera);
    expect(back.x).toBeCloseTo(world.x);
    expect(back.y).toBeCloseTo(world.y);
  });

  it("keeps the world point under the pointer stable during zoom", () => {
    const camera: PhysicsCamera = { x: -3, y: 8, zoom: 0.8 };
    const pointer = { x: 201, y: 119 };
    const before = screenToWorld(pointer, size, camera);
    const after = screenToWorld(pointer, size, zoomPhysicsAt(pointer, size, camera, 2.1));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("chooses a 1-2-5 grid step with finite values over supported zoom", () => {
    for (const zoom of [0.1, 0.5, 1, 2, 8]) {
      const step = physicsGridStep(size, { x: 0, y: 0, zoom });
      const mantissa = step / 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 5, 10]).toContain(mantissa);
      expect(Number.isFinite(step)).toBe(true);
    }
  });

  it("fits finite bounds around a bounded projectile trajectory", () => {
    const project = createPhysicsProject("projectile");
    const samples = [frame(0, 0, 0), frame(60, 6, 4), frame(120, 12, 0)];
    const bounds = physicsWorldBounds(project, samples, samples.at(-1) ?? null);
    const camera = fitPhysicsCamera(project, samples, samples.at(-1) ?? null, size);
    expect(bounds).not.toBeNull();
    expect(camera.zoom).toBeGreaterThanOrEqual(0.1);
    expect(camera.zoom).toBeLessThanOrEqual(8);
    const points = [
      worldToScreen({ x: bounds!.minX, y: bounds!.minY }, size, camera),
      worldToScreen({ x: bounds!.maxX, y: bounds!.maxY }, size, camera),
    ];
    for (const point of points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(-1);
      expect(point.x).toBeLessThanOrEqual(size.width + 1);
      expect(point.y).toBeGreaterThanOrEqual(-1);
      expect(point.y).toBeLessThanOrEqual(size.height + 1);
    }
  });

  it("fits the spring anchor, equilibrium and displacement into view", () => {
    const project = createPhysicsProject("spring");
    const samples = [frame(0, -1.5, 0), frame(60, 0, 0), frame(120, 1.2, 0)];
    const camera = fitPhysicsCamera(project, samples, samples[0], { width: 340, height: 280 });
    expect(Number.isFinite(camera.x + camera.y + camera.zoom)).toBe(true);
    expect(camera.zoom).toBeGreaterThanOrEqual(0.1);
  });

  it("limits path sampling and preserves the first and last states", () => {
    const samples = Array.from({ length: 10_000 }, (_, index) => frame(index, index, Math.sin(index)));
    const bounded = boundedPhysicsSamples(samples);
    expect(bounded.length).toBeLessThanOrEqual(4096);
    expect(bounded[0]).toBe(samples[0]);
    expect(bounded.at(-1)).toBe(samples.at(-1));
  });

  it("scales velocity and force vectors independently for their own SI units", () => {
    const samples = [frame(0, 0, 0, 20, 0, 0, -4), frame(1, 0, 0, 10, 0, 0, -2)];
    const velocityScale = vectorPixelsPerUnit(samples, "velocity", size);
    const forceScale = vectorPixelsPerUnit(samples, "force", size);
    expect(velocityScale).toBeGreaterThan(0);
    expect(forceScale).toBeGreaterThan(0);
    expect(velocityScale).not.toBe(forceScale);
  });
});
