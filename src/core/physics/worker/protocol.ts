import { z } from "zod";
import { PHYSICS_MAX_BATCH_STEPS, PHYSICS_MAX_TOTAL_STEPS, parsePhysicsProject, type PhysicsProject } from "../model/schema";
import type { SimulationFrame } from "../engine/simulation";

export const PHYSICS_WORKER_PROTOCOL_VERSION = 1 as const;
export const PHYSICS_MAX_SAMPLES = 2_048;

const requestBase = {
  protocolVersion: z.literal(PHYSICS_WORKER_PROTOCOL_VERSION),
  sessionId: z.number().int().safe().positive(),
  requestId: z.number().int().safe().positive(),
};

export const physicsWorkerRequestSchema = z.discriminatedUnion("type", [
  z.object({ ...requestBase, type: z.literal("initialize"), project: z.unknown() }).strict(),
  z.object({ ...requestBase, type: z.literal("run") }).strict(),
  z.object({ ...requestBase, type: z.literal("pause") }).strict(),
  z.object({ ...requestBase, type: z.literal("step"), count: z.number().int().min(1).max(PHYSICS_MAX_BATCH_STEPS) }).strict(),
  z.object({ ...requestBase, type: z.literal("reset") }).strict(),
  z.object({ ...requestBase, type: z.literal("seek"), targetStep: z.number().int().min(0).max(PHYSICS_MAX_TOTAL_STEPS) }).strict(),
  z.object({ ...requestBase, type: z.literal("dispose") }).strict(),
]);

export type PhysicsWorkerRequest = z.infer<typeof physicsWorkerRequestSchema>;
export type ValidatedPhysicsWorkerRequest = Exclude<PhysicsWorkerRequest, { type: "initialize" }> | (Extract<PhysicsWorkerRequest, { type: "initialize" }> & { project: PhysicsProject });
export type PhysicsRuntimeStatus = "idle" | "running" | "paused" | "completed" | "error";

export interface PhysicsRuntimeDiagnostics {
  completedSteps: number;
  maximumSteps: number;
  effectiveSampleEvery: number;
  sampleCount: number;
  lastWorkMs: number;
  lagEvents: number;
}

export interface PhysicsWorkerSnapshot {
  protocolVersion: typeof PHYSICS_WORKER_PROTOCOL_VERSION;
  sessionId: number;
  requestId: number;
  type: "snapshot";
  status: PhysicsRuntimeStatus;
  frame: SimulationFrame | null;
  samples: SimulationFrame[];
  error: string | null;
  diagnostics: PhysicsRuntimeDiagnostics;
}

export interface PhysicsWorkerDisposed {
  protocolVersion: typeof PHYSICS_WORKER_PROTOCOL_VERSION;
  sessionId: number;
  requestId: number;
  type: "disposed";
}

export type PhysicsWorkerResponse = PhysicsWorkerSnapshot | PhysicsWorkerDisposed;

const vectorSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
export const simulationFrameSchema = z.object({
  step: z.number().int().nonnegative(),
  time: z.number().finite().nonnegative(),
  position: vectorSchema,
  velocity: vectorSchema,
  acceleration: vectorSchema,
  force: vectorSchema,
  kineticEnergy: z.number().finite().nonnegative(),
  potentialEnergy: z.number().finite(),
  totalEnergy: z.number().finite(),
  terminated: z.boolean(),
  terminationReason: z.enum(["ground-contact", "duration"]).optional(),
}).strict();

export const physicsWorkerResponseSchema = z.discriminatedUnion("type", [
  z.object({
    protocolVersion: z.literal(PHYSICS_WORKER_PROTOCOL_VERSION),
    sessionId: z.number().int().safe().positive(),
    requestId: z.number().int().safe().positive(),
    type: z.literal("snapshot"),
    status: z.enum(["idle", "running", "paused", "completed", "error"]),
    frame: simulationFrameSchema.nullable(),
    samples: z.array(simulationFrameSchema).max(PHYSICS_MAX_SAMPLES),
    error: z.string().max(1_000).nullable(),
    diagnostics: z.object({
      completedSteps: z.number().int().nonnegative(),
      maximumSteps: z.number().int().nonnegative(),
      effectiveSampleEvery: z.number().int().positive(),
      sampleCount: z.number().int().nonnegative().max(PHYSICS_MAX_SAMPLES),
      lastWorkMs: z.number().finite().nonnegative(),
      lagEvents: z.number().int().nonnegative(),
    }).strict(),
  }).strict(),
  z.object({
    protocolVersion: z.literal(PHYSICS_WORKER_PROTOCOL_VERSION),
    sessionId: z.number().int().safe().positive(),
    requestId: z.number().int().safe().positive(),
    type: z.literal("disposed"),
  }).strict(),
]);

export function parsePhysicsWorkerRequest(value: unknown): ValidatedPhysicsWorkerRequest | null {
  const parsed = physicsWorkerRequestSchema.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.type !== "initialize") return parsed.data;
  const project = parsePhysicsProject(parsed.data.project);
  return project ? { ...parsed.data, project } : null;
}

export function isPhysicsProject(value: unknown): value is PhysicsProject {
  return parsePhysicsProject(value) !== null;
}

export function parsePhysicsWorkerResponse(value: unknown): PhysicsWorkerResponse | null {
  const parsed = physicsWorkerResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
