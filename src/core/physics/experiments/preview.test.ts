import { describe, expect, it } from "vitest";
import { PhysicsSimulation } from "../engine/simulation";
import { createPhysicsProject, parsePhysicsProject } from "../model/schema";
import { createDefaultProjectilePreview, createPhysicsPreview, PHYSICS_PREVIEW_STEP_LIMIT } from "./preview";

describe("bounded Physics previews", () => {
  it("uses the deterministic default project and production solver samples for the home trajectory", () => {
    const preview = createDefaultProjectilePreview();
    const replay = createDefaultProjectilePreview();
    const simulation = new PhysicsSimulation(preview.project);
    const expectedFrames = [simulation.frame];

    for (let step = 0; step < preview.stepCount; step++) expectedFrames.push(simulation.step(1));

    expect(preview.project.id).toBe("physics-home-preview");
    expect(preview.project.createdAt).toBe(0);
    expect(preview.project.updatedAt).toBe(0);
    expect(preview.frames).toEqual(expectedFrames);
    expect(replay.frames).toEqual(preview.frames);
    expect(preview.frames.length).toBeLessThanOrEqual(PHYSICS_PREVIEW_STEP_LIMIT + 1);
    expect(preview.frames.at(-1)?.terminationReason).toBe("ground-contact");
    expect(preview.apex).toEqual(preview.frames.reduce((highest, frame) => frame.position.y > highest.position.y ? frame : highest));
    expect(preview.launchSpeed).toBeCloseTo(Math.hypot(
      preview.frames[0].velocity.x,
      preview.frames[0].velocity.y,
    ));
    expect(preview.flightTime).toBe(preview.frames.at(-1)?.time);
    expect(preview.horizontalRange).toBeCloseTo(
      (preview.frames.at(-1)?.position.x ?? 0) - preview.frames[0].position.x,
    );
  });

  it("clamps preview work and sample count to the shared 1,200 step budget", () => {
    const base = createPhysicsProject("projectile", "bounded-preview-test", 0);
    if (base.model.kind !== "projectile") throw new Error("Expected projectile defaults");
    const project = parsePhysicsProject({
      ...base,
      model: { ...base.model, parameters: { ...base.model.parameters, gravity: 0, initialY: 10, velocityY: 0, velocityX: 1 } },
      simulation: { ...base.simulation, fixedTimeStep: 0.01, duration: 20, maximumSubsteps: 10 },
    });
    if (!project) throw new Error("Expected a valid long-running preview project");

    const preview = createPhysicsPreview(project, Number.MAX_SAFE_INTEGER);

    expect(preview.stepCount).toBe(PHYSICS_PREVIEW_STEP_LIMIT);
    expect(preview.frames).toHaveLength(PHYSICS_PREVIEW_STEP_LIMIT + 1);
    expect(preview.reachedStepLimit).toBe(true);
    expect(preview.frames.at(-1)?.time).toBeCloseTo(12);
  });

  it("supports a smaller explicit budget and rejects invalid budgets", () => {
    const project = createPhysicsProject("projectile", "small-preview-test", 0);
    const preview = createPhysicsPreview(project, 8);

    expect(preview.stepCount).toBe(8);
    expect(preview.frames).toHaveLength(9);
    expect(preview.reachedStepLimit).toBe(true);
    expect(() => createPhysicsPreview(project, -1)).toThrow(RangeError);
    expect(() => createPhysicsPreview(project, 1.5)).toThrow(RangeError);
  });
});
