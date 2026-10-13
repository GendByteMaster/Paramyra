"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parsePhysicsProject, type PhysicsProject } from "../../core/physics/model/schema";
import { physicsExecutionKey } from "../../core/physics/worker/execution-key";
import {
  PHYSICS_WORKER_PROTOCOL_VERSION,
  parsePhysicsWorkerResponse,
  type PhysicsRuntimeDiagnostics,
  type PhysicsRuntimeStatus,
  type PhysicsWorkerRequest,
} from "../../core/physics/worker/protocol";
import type { SimulationFrame } from "../../core/physics/engine/simulation";

const MAX_SEEK_STEP = 1_000_000;
let nextSessionId = 0;

const emptyDiagnostics = (): PhysicsRuntimeDiagnostics => ({
  completedSteps: 0,
  maximumSteps: 0,
  effectiveSampleEvery: 1,
  sampleCount: 0,
  lastWorkMs: 0,
  lagEvents: 0,
});

export interface PhysicsRuntimeResult {
  frame: SimulationFrame | null;
  samples: SimulationFrame[];
  status: PhysicsRuntimeStatus;
  error: string | null;
  diagnostics: PhysicsRuntimeDiagnostics;
  run(): void;
  pause(): void;
  step(): void;
  reset(): void;
  seek(targetStep: number): void;
  restart(): void;
}

interface RuntimeSnapshot {
  frame: SimulationFrame | null;
  samples: SimulationFrame[];
  status: PhysicsRuntimeStatus;
  error: string | null;
  diagnostics: PhysicsRuntimeDiagnostics;
}

interface SnapshotRecord {
  executionKey: string | null;
  restartToken: number;
  snapshot: RuntimeSnapshot;
}

function newSessionId(): number {
  if (nextSessionId >= Number.MAX_SAFE_INTEGER) throw new RangeError("Physics worker session ID space is exhausted.");
  nextSessionId += 1;
  return nextSessionId;
}

function initialSnapshot(): RuntimeSnapshot {
  return { frame: null, samples: [], status: "idle", error: null, diagnostics: emptyDiagnostics() };
}

function errorSnapshot(message: string): RuntimeSnapshot {
  return { ...initialSnapshot(), status: "error", error: message.slice(0, 1_000) };
}

/** Run one validated PhysicsProject in an isolated, deterministic Web Worker. */
export function usePhysicsRuntime(project: PhysicsProject): PhysicsRuntimeResult {
  const [record, setRecord] = useState<SnapshotRecord | null>(null);
  const [restartToken, setRestartToken] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const latestProjectRef = useRef<PhysicsProject | null>(null);
  const sendRef = useRef<((type: "run" | "pause" | "step" | "reset" | "seek", targetStep?: number) => void) | null>(null);

  const projectJSON = useMemo(() => {
    try {
      return JSON.stringify(project);
    } catch {
      return null;
    }
  }, [project]);
  const validatedProject = useMemo(() => {
    if (!projectJSON) return null;
    try {
      return parsePhysicsProject(JSON.parse(projectJSON) as unknown);
    } catch {
      return null;
    }
  }, [projectJSON]);
  const executionKey = useMemo(() => validatedProject ? physicsExecutionKey(validatedProject) : null, [validatedProject]);
  const fallbackSnapshot = useMemo(() => {
    if (!projectJSON) return errorSnapshot("This physics project could not be serialized for the worker.");
    if (!validatedProject) return errorSnapshot("This physics project failed strict validation and was not sent to the worker.");
    if (typeof window !== "undefined" && typeof Worker === "undefined") {
      return errorSnapshot("Web Workers are unavailable in this browser. Physics simulation requires a worker.");
    }
    return initialSnapshot();
  }, [projectJSON, validatedProject]);
  const snapshot = validatedProject && record?.executionKey === executionKey && record.restartToken === restartToken
    ? record.snapshot
    : fallbackSnapshot;

  const updateSnapshot = useCallback((update: (current: RuntimeSnapshot) => RuntimeSnapshot) => {
    setRecord(previous => {
      const current = previous?.executionKey === executionKey && previous.restartToken === restartToken
        ? previous.snapshot
        : initialSnapshot();
      return { executionKey, restartToken, snapshot: update(current) };
    });
  }, [executionKey, restartToken]);
  const replaceSnapshot = useCallback((next: RuntimeSnapshot) => {
    setRecord({ executionKey, restartToken, snapshot: next });
  }, [executionKey, restartToken]);

  useEffect(() => {
    latestProjectRef.current = validatedProject;
  }, [validatedProject]);

  useEffect(() => {
    if (!executionKey || typeof Worker === "undefined") return;

    let cancelled = false;
    let worker: Worker | null = null;
    let cleanupRequest: (() => void) | null = null;

    // Defer startup out of the effect body so project-key changes render from
    // their own empty snapshot without a synchronous state update or cascade.
    queueMicrotask(() => {
      if (cancelled) return;
      const workerProject = latestProjectRef.current;
      if (!workerProject) {
        replaceSnapshot(errorSnapshot("This physics project failed strict validation and was not sent to the worker."));
        return;
      }
      let sessionId: number;
      try {
        sessionId = newSessionId();
        worker = new Worker(new URL("../../core/physics/worker/physics.worker.ts", import.meta.url), {
          type: "module",
          name: "paramyra-physics-runtime",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Worker construction failed.";
        replaceSnapshot(errorSnapshot(`Physics worker could not start: ${message}`));
        return;
      }

      const currentWorker = worker;
      let requestId = 0;
      let latestRequestedId = 0;
      let failed = false;
      const send = (type: "run" | "pause" | "step" | "reset" | "seek", targetStep?: number) => {
        if (failed || workerRef.current !== currentWorker) return;
        const id = ++requestId;
        latestRequestedId = id;
        const base = { protocolVersion: PHYSICS_WORKER_PROTOCOL_VERSION, sessionId, requestId: id };
        let request: PhysicsWorkerRequest;
        if (type === "seek") {
          if (!Number.isSafeInteger(targetStep) || (targetStep as number) < 0 || (targetStep as number) > MAX_SEEK_STEP) {
            try {
              currentWorker.postMessage({ ...base, type: "pause" });
              latestRequestedId = ++requestId;
            } catch {
              failed = true;
              currentWorker.terminate();
              if (workerRef.current === currentWorker) workerRef.current = null;
            }
            updateSnapshot(previous => ({ ...previous, status: "paused", error: `Seek target must be an integer from 0 to ${MAX_SEEK_STEP}.` }));
            return;
          }
          request = { ...base, type, targetStep: targetStep as number };
        } else if (type === "step") {
          request = { ...base, type, count: 1 };
        } else {
          request = { ...base, type };
        }
        try {
          currentWorker.postMessage(request);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not send a command to the physics worker.";
          updateSnapshot(previous => ({ ...previous, status: "error", error: message }));
        }
      };

      workerRef.current = currentWorker;
      sendRef.current = send;
      currentWorker.onmessage = event => {
        if (failed || workerRef.current !== currentWorker) return;
        const response = parsePhysicsWorkerResponse(event.data);
        if (!response) {
          failed = true;
          updateSnapshot(previous => ({ ...previous, status: "error", error: "The physics worker returned an invalid protocol message." }));
          currentWorker.terminate();
          if (workerRef.current === currentWorker) workerRef.current = null;
          return;
        }
        if (response.sessionId !== sessionId || response.requestId < latestRequestedId || response.type === "disposed") return;
        replaceSnapshot({
          frame: response.frame,
          samples: response.samples,
          status: response.status,
          error: response.error,
          diagnostics: response.diagnostics,
        });
      };
      currentWorker.onerror = event => {
        if (workerRef.current !== currentWorker) return;
        failed = true;
        const detail = event.message || "Unknown worker execution error.";
        updateSnapshot(previous => ({ ...previous, status: "error", error: `Physics worker failed: ${detail}` }));
        currentWorker.terminate();
        workerRef.current = null;
      };
      currentWorker.onmessageerror = () => {
        if (workerRef.current !== currentWorker) return;
        failed = true;
        updateSnapshot(previous => ({ ...previous, status: "error", error: "The browser could not deserialize a physics worker response." }));
        currentWorker.terminate();
        workerRef.current = null;
      };
      requestId += 1;
      latestRequestedId = requestId;
      try {
        currentWorker.postMessage({
          protocolVersion: PHYSICS_WORKER_PROTOCOL_VERSION,
          sessionId,
          requestId,
          type: "initialize",
          project: workerProject,
        });
      } catch (error) {
        failed = true;
        const message = error instanceof Error ? error.message : "Could not initialize the physics worker.";
        replaceSnapshot(errorSnapshot(`Physics worker could not receive the project: ${message}`));
        currentWorker.terminate();
        workerRef.current = null;
        if (sendRef.current === send) sendRef.current = null;
        return;
      }

      cleanupRequest = () => {
        if (workerRef.current === currentWorker) {
          try {
            const id = ++requestId;
            currentWorker.postMessage({ protocolVersion: PHYSICS_WORKER_PROTOCOL_VERSION, sessionId, requestId: id, type: "dispose" });
          } catch {
            // Termination below still releases the worker if posting dispose fails.
          }
          workerRef.current = null;
        }
        currentWorker.terminate();
        if (sendRef.current === send) sendRef.current = null;
      };
    });

    return () => {
      cancelled = true;
      cleanupRequest?.();
    };
  }, [executionKey, restartToken, replaceSnapshot, updateSnapshot]);

  const command = useCallback((type: "run" | "pause" | "step" | "reset" | "seek", targetStep?: number) => {
    sendRef.current?.(type, targetStep);
  }, []);
  const run = useCallback(() => command("run"), [command]);
  const pause = useCallback(() => command("pause"), [command]);
  const step = useCallback(() => command("step"), [command]);
  const reset = useCallback(() => command("reset"), [command]);
  const seek = useCallback((targetStep: number) => command("seek", targetStep), [command]);
  const restart = useCallback(() => setRestartToken(value => value + 1), []);

  return { ...snapshot, run, pause, step, reset, seek, restart };
}
