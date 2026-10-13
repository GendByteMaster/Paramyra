import { describe, expect, it } from "vitest";
import { createPhysicsProject, physicsProjectSchema } from "../model/schema";
import { physicsExecutionKey } from "./execution-key";

describe("physics worker execution identity", () => {
  it("ignores display, scene, timestamp, and lab report edits", () => {
    const project = createPhysicsProject("projectile", "project-a", 10);
    const edited = physicsProjectSchema.parse({
      ...project,
      name: "Renamed experiment",
      createdAt: 11,
      updatedAt: 12,
      scene: { ...project.scene, camera: { x: 30, y: -4, zoom: 2 }, showGrid: false, showTrail: false },
      labReport: { hypothesis: "Updated hypothesis", notes: "Updated notes", conclusion: "Updated conclusion" },
    });
    expect(physicsExecutionKey(edited)).toBe(physicsExecutionKey(project));
  });

  it("changes when project identity, model parameters, or simulation settings change", () => {
    const project = createPhysicsProject("spring", "project-a", 10);
    if (project.model.kind !== "spring") throw new Error("Expected a spring project");
    const renamedId = physicsProjectSchema.parse({ ...project, id: "project-b" });
    const changedModel = physicsProjectSchema.parse({
      ...project,
      model: { ...project.model, parameters: { ...project.model.parameters, stiffness: project.model.parameters.stiffness * 2 } },
    });
    const changedSimulation = physicsProjectSchema.parse({
      ...project,
      simulation: { ...project.simulation, fixedTimeStep: project.simulation.fixedTimeStep / 2 },
    });
    expect(physicsExecutionKey(renamedId)).not.toBe(physicsExecutionKey(project));
    expect(physicsExecutionKey(changedModel)).not.toBe(physicsExecutionKey(project));
    expect(physicsExecutionKey(changedSimulation)).not.toBe(physicsExecutionKey(project));
  });
});
