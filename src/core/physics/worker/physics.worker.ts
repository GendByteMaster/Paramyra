import { PhysicsSimulation } from "../engine/simulation";
import { PhysicsRuntimeController } from "./runtime-controller";

interface WorkerPort {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: unknown): void;
}

const port = globalThis as unknown as WorkerPort;
const controller = new PhysicsRuntimeController(
  response => port.postMessage(response),
  { createSimulation: project => new PhysicsSimulation(project) },
);

port.onmessage = event => controller.receive(event.data);
