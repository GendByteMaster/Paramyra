import { describe, expect, it } from "vitest";
import { createPhysicsProject } from "../model/schema";
import {
  PHYSICS_MAX_SAMPLES,
  PHYSICS_WORKER_PROTOCOL_VERSION,
  parsePhysicsWorkerRequest,
  parsePhysicsWorkerResponse,
  simulationFrameSchema,
} from "./protocol";

const frame = (step: number) => ({
  step,
  time: step / 120,
  position: { x: step, y: 0 },
  velocity: { x: 1, y: 0 },
  acceleration: { x: 0, y: 0 },
  force: { x: 0, y: 0 },
  kineticEnergy: 0.5,
  potentialEnergy: 0,
  totalEnergy: 0.5,
  terminated: false,
});

describe("physics worker protocol", () => {
  it("strictly validates request envelopes, project data, and integer seek targets", () => {
    const base = { protocolVersion: PHYSICS_WORKER_PROTOCOL_VERSION, sessionId: 1, requestId: 1 };
    expect(parsePhysicsWorkerRequest({ ...base, type: "initialize", project: createPhysicsProject("spring") })?.type).toBe("initialize");
    expect(parsePhysicsWorkerRequest({ ...base, type: "initialize", project: { schemaVersion: 999 } })).toBeNull();
    expect(parsePhysicsWorkerRequest({ ...base, type: "run", extra: true })).toBeNull();
    expect(parsePhysicsWorkerRequest({ ...base, type: "seek", targetStep: 3.2 })).toBeNull();
    expect(parsePhysicsWorkerRequest({ ...base, type: "seek", targetStep: 1_000_001 })).toBeNull();
    expect(parsePhysicsWorkerRequest({ ...base, type: "step", count: 0 })).toBeNull();
  });

  it("validates worker snapshots and rejects oversized or malformed frame data", () => {
    const snapshot = {
      protocolVersion: PHYSICS_WORKER_PROTOCOL_VERSION,
      sessionId: 1,
      requestId: 1,
      type: "snapshot",
      status: "paused",
      frame: frame(1),
      samples: [frame(0), frame(1)],
      error: null,
      diagnostics: { completedSteps: 1, maximumSteps: 1200, effectiveSampleEvery: 1, sampleCount: 2, lastWorkMs: 0, lagEvents: 0 },
    };
    expect(parsePhysicsWorkerResponse(snapshot)?.type).toBe("snapshot");
    expect(parsePhysicsWorkerResponse({ ...snapshot, status: "maybe" })).toBeNull();
    expect(parsePhysicsWorkerResponse({ ...snapshot, frame: { ...frame(1), position: { x: Number.NaN, y: 0 } } })).toBeNull();
    expect(simulationFrameSchema.safeParse({ ...frame(1), terminationReason: "unknown" }).success).toBe(false);
    expect(parsePhysicsWorkerResponse({ ...snapshot, samples: Array.from({ length: PHYSICS_MAX_SAMPLES + 1 }, (_, i) => frame(i)) })).toBeNull();
  });
});
