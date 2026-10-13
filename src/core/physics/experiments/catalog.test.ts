import { describe, expect, it } from "vitest";
import { getPhysicsExperiment, PHYSICS_EXPERIMENTS } from "./catalog";

describe("Physics experiment catalog", () => {
  it("publishes the two versioned mechanics experiments with bounded SI controls", () => {
    expect(PHYSICS_EXPERIMENTS.map(({ id }) => id)).toEqual(["projectile", "spring"]);
    for (const experiment of PHYSICS_EXPERIMENTS) {
      expect(experiment.modelVersion).toBe(1);
      expect(experiment.category).toBe("Mechanics");
      expect(experiment.complexity).toBe("beginner");
      expect(experiment.parameters.length).toBeGreaterThan(0);
      expect(experiment.assumptions.length).toBeGreaterThan(0);
      expect(experiment.excludedEffects.length).toBeGreaterThan(0);
      for (const parameter of experiment.parameters) {
        expect(parameter.defaultValue).toBeGreaterThanOrEqual(parameter.minimum);
        expect(parameter.defaultValue).toBeLessThanOrEqual(parameter.maximum);
      }
      expect(experiment.createProject("catalog-test", 1).model.kind).toBe(experiment.id);
    }
  });

  it("includes analytical reference cases for vacuum flight and damped/undamped oscillation", () => {
    const projectile = getPhysicsExperiment("projectile").referenceCases[0];
    expect(projectile.expected.flightTime).toBeCloseTo(2 * 10 / 9.81, 10);
    expect(projectile.expected.range).toBeCloseTo(10 * projectile.expected.flightTime, 10);
    expect(projectile.expected.peakHeight).toBeCloseTo(100 / (2 * 9.81), 10);
    expect(projectile.absoluteTolerance).toBeGreaterThan(0);

    const spring = getPhysicsExperiment("spring");
    expect(spring.referenceCases).toHaveLength(2);
    expect(spring.referenceCases[0].expected.totalEnergy).toBe(2);
    expect(spring.referenceCases[1].expected.displacement).toBeCloseTo(-0.1453279381206481, 12);
  });

  it("rejects an unknown experiment kind", () => {
    expect(() => getPhysicsExperiment("fluid" as "projectile")).toThrow(RangeError);
  });
});
