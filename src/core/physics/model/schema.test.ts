import { describe, expect, it } from "vitest";
import {
  createPhysicsProject,
  parsePhysicsProject,
  parsePhysicsProjectJSON,
  PHYSICS_JSON_MAX_BYTES,
} from "./schema";

describe("PhysicsProject schema", () => {
  it("creates valid SI defaults for both versioned experiments", () => {
    const projectile = createPhysicsProject("projectile", "p-1", 1234);
    const spring = createPhysicsProject("spring", "s-1", 5678);
    expect(projectile).toMatchObject({ schemaVersion: 1, unitPolicy: "SI", createdAt: 1234, model: { kind: "projectile", modelVersion: 1 } });
    expect(spring).toMatchObject({ model: { kind: "spring", modelVersion: 1, parameters: { mass: 1, stiffness: 4 } } });
    expect(parsePhysicsProject(projectile)).toEqual(projectile);
    expect(parsePhysicsProject(spring)).toEqual(spring);
  });

  it("rejects unknown fields, future schema/model versions, and malformed JSON", () => {
    const project = createPhysicsProject("projectile");
    expect(parsePhysicsProject({ ...project, untrusted: true })).toBeNull();
    expect(parsePhysicsProject({ ...project, name: "   " })).toBeNull();
    expect(parsePhysicsProject({ ...project, schemaVersion: 2 })).toBeNull();
    expect(parsePhysicsProject({ ...project, model: { ...project.model, modelVersion: 2 } })).toBeNull();
    expect(parsePhysicsProjectJSON("{" )).toBeNull();
    expect(parsePhysicsProjectJSON(JSON.stringify(project))).toEqual(project);
  });

  it("enforces UTF-8 JSON byte limits and derived simulation safety", () => {
    const project = createPhysicsProject("projectile");
    expect(parsePhysicsProjectJSON(" ".repeat(PHYSICS_JSON_MAX_BYTES + 1))).toBeNull();
    expect(parsePhysicsProjectJSON(JSON.stringify({ ...project, notes: "🙂".repeat(80_000) }))).toBeNull();

    const tooStiff = {
      ...createPhysicsProject("spring"),
      model: { ...createPhysicsProject("spring").model, parameters: { mass: 1, stiffness: 1_000_000, damping: 0, displacement: 0, velocity: 0 } },
    };
    expect(parsePhysicsProject(tooStiff)).toBeNull();

    const excessiveSteps = { ...project, simulation: { ...project.simulation, duration: 600, fixedTimeStep: 1e-4 } };
    expect(parsePhysicsProject(excessiveSteps)).toBeNull();
  });

  it("rejects inconsistent timestamps and non-finite values", () => {
    const project = createPhysicsProject("spring", "s", 100);
    expect(parsePhysicsProject({ ...project, updatedAt: 99 })).toBeNull();
    expect(parsePhysicsProject({ ...project, model: { ...project.model, parameters: { ...project.model.parameters, mass: Infinity } } })).toBeNull();
  });
});
