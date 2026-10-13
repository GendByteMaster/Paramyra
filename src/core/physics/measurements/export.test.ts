import { describe, expect, it } from "vitest";
import { PhysicsSimulation } from "../engine/simulation";
import { createPhysicsProject } from "../model/schema";
import { exportMeasurementsCSV, exportMeasurementsJSON, parseMeasurementsJSON } from "./export";

describe("versioned Physics measurement snapshots", () => {
  const project = createPhysicsProject("spring", "source", 1);
  const engine = new PhysicsSimulation(project);
  const samples = [engine.frame, engine.step(), engine.step()];

  it("round trips SI records and complete model/solver/initial condition provenance", () => {
    const text = exportMeasurementsJSON(project, samples)!;
    const imported = parseMeasurementsJSON(text)!;
    expect(imported.project).toEqual(project);
    expect(imported.samples).toEqual(samples);
    expect(imported.units.force).toBe("N");
    expect(imported.project.simulation.integratorVersion).toBe(1);
  });

  it("rejects nonfinite, unordered, mismatched energy and oversized/future snapshots", () => {
    expect(exportMeasurementsJSON(project, [...samples].reverse())).toBeNull();
    expect(exportMeasurementsJSON(project, [{ ...samples[0], totalEnergy: 123 }])).toBeNull();
    expect(exportMeasurementsJSON(project, [{ ...samples[0], position: { x: Infinity, y: 0 } }])).toBeNull();
    expect(exportMeasurementsJSON(project, Array.from({ length: 2049 }, () => samples[0]))).toBeNull();
    const raw = JSON.parse(exportMeasurementsJSON(project, samples)!);
    expect(parseMeasurementsJSON(JSON.stringify({ ...raw, schemaVersion: 2 }))).toBeNull();
    expect(parseMeasurementsJSON(JSON.stringify({ ...raw, script: "alert(1)" }))).toBeNull();
    expect(parseMeasurementsJSON(" ".repeat(2 * 1024 * 1024 + 1))).toBeNull();
  });

  it("exports independently inspectable numeric CSV with escaped provenance", () => {
    const csv = exportMeasurementsCSV({ ...project, name: '=HYPERLINK("unsafe"),a\nb' }, samples)!;
    expect(csv).toContain("# unitPolicy,SI");
    expect(csv).toContain("time_s,x_m,y_m,vx_m_s");
    expect(csv).toContain('""stiffness"":4');
    expect(csv).toContain("symplectic-euler");
    const lines = csv.split("\r\n");
    expect(lines[6].split(",").map(Number)).toEqual([
      0, 0, 1, 0, 0, 0, -4, 0, -4, 0, 0, 2, 2,
    ]);
  });

  it("rejects contradictory clocks, termination reasons, dimensions and model-derived measurements", () => {
    const frame = samples[1];
    for (const invalid of [
      { ...frame, time: 10 }, { ...frame, terminationReason: "duration" as const },
      { ...frame, position: { x: 1e9, y: -1e9 } }, { ...frame, force: { x: 0, y: 0 } },
      { ...frame, terminated: true }, { ...samples[0], position: { x: 2, y: 0 } },
    ]) expect(exportMeasurementsJSON(project, [invalid])).toBeNull();
    const raw = JSON.parse(exportMeasurementsJSON(project, samples)!);
    raw.samples[1].time = 10;
    expect(parseMeasurementsJSON(JSON.stringify(raw))).toBeNull();
  });

  it("accepts duration remainders, initial completion and localized ground contact", () => {
    const remainder = { ...project, simulation: { ...project.simulation, duration: 0.01 } };
    const spring = new PhysicsSimulation(remainder);
    expect(exportMeasurementsJSON(remainder, [spring.frame, spring.step(), spring.step()])).not.toBeNull();
    const zero = { ...project, simulation: { ...project.simulation, duration: 0 } };
    expect(exportMeasurementsJSON(zero, [new PhysicsSimulation(zero).frame])).not.toBeNull();
    const ball = createPhysicsProject("projectile", "impact", 1);
    const flight = new PhysicsSimulation(ball);
    const frames = [flight.frame];
    while (!flight.frame.terminated) frames.push(flight.step());
    expect(exportMeasurementsJSON(ball, frames)).not.toBeNull();
  });
});
