import type { PhysicsProject } from "../model/schema";
import type { SimulationFrame } from "../engine/simulation";

export type PhysicsSize = Readonly<{ width: number; height: number }>;
export type PhysicsPoint = Readonly<{ x: number; y: number }>;
export type PhysicsCamera = Readonly<{ x: number; y: number; zoom: number }>;
export type PhysicsBounds = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;

export const PHYSICS_MIN_ZOOM = 0.1;
export const PHYSICS_MAX_ZOOM = 8;
export const PHYSICS_MAX_RENDER_SAMPLES = 4096;
const MAX_RENDER_COORDINATE = 1e7;

export function clampPhysicsZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.min(PHYSICS_MAX_ZOOM, Math.max(PHYSICS_MIN_ZOOM, zoom)) : 1;
}

export function normalizePhysicsSize(size: PhysicsSize): PhysicsSize {
  return {
    width: Number.isFinite(size.width) ? Math.max(1, Math.min(size.width, 20_000)) : 1,
    height: Number.isFinite(size.height) ? Math.max(1, Math.min(size.height, 20_000)) : 1,
  };
}

export function pixelsPerMeter(size: PhysicsSize, camera: PhysicsCamera): number {
  const normalized = normalizePhysicsSize(size);
  return Math.min(normalized.width, normalized.height, 800) / 8 * clampPhysicsZoom(camera.zoom);
}

export function worldToScreen(point: PhysicsPoint, size: PhysicsSize, camera: PhysicsCamera): PhysicsPoint {
  const normalized = normalizePhysicsSize(size);
  const scale = pixelsPerMeter(normalized, camera);
  return {
    x: normalized.width / 2 + (point.x - camera.x) * scale,
    y: normalized.height / 2 - (point.y - camera.y) * scale,
  };
}

export function screenToWorld(point: PhysicsPoint, size: PhysicsSize, camera: PhysicsCamera): PhysicsPoint {
  const normalized = normalizePhysicsSize(size);
  const scale = pixelsPerMeter(normalized, camera);
  return {
    x: camera.x + (point.x - normalized.width / 2) / scale,
    y: camera.y - (point.y - normalized.height / 2) / scale,
  };
}

export function zoomPhysicsAt(point: PhysicsPoint, size: PhysicsSize, camera: PhysicsCamera, zoom: number): PhysicsCamera {
  const normalized = normalizePhysicsSize(size);
  const anchor = screenToWorld(point, normalized, camera);
  const nextZoom = clampPhysicsZoom(zoom);
  const scale = pixelsPerMeter(normalized, { ...camera, zoom: nextZoom });
  return {
    x: anchor.x - (point.x - normalized.width / 2) / scale,
    y: anchor.y + (point.y - normalized.height / 2) / scale,
    zoom: nextZoom,
  };
}

/** Return a deterministic 1-2-5 decade step with a useful pixel spacing. */
export function physicsGridStep(size: PhysicsSize, camera: PhysicsCamera, targetPixels = 96): number {
  const desired = targetPixels / Math.max(pixelsPerMeter(size, camera), 1e-9);
  if (!Number.isFinite(desired) || desired <= 0) return 1;
  const decade = 10 ** Math.floor(Math.log10(desired));
  const normalized = desired / decade;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * decade;
}

export function visiblePhysicsBounds(size: PhysicsSize, camera: PhysicsCamera): PhysicsBounds {
  const normalized = normalizePhysicsSize(size);
  const a = screenToWorld({ x: 0, y: normalized.height }, normalized, camera);
  const b = screenToWorld({ x: normalized.width, y: 0 }, normalized, camera);
  return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
}

function toFinitePoint(frame: SimulationFrame): PhysicsPoint | null {
  const { x, y } = frame.position;
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > MAX_RENDER_COORDINATE || Math.abs(y) > MAX_RENDER_COORDINATE) return null;
  return { x, y };
}

/** Select evenly spaced samples so large worker histories remain bounded in the renderer. */
export function boundedPhysicsSamples(samples: readonly SimulationFrame[]): readonly SimulationFrame[] {
  if (samples.length <= PHYSICS_MAX_RENDER_SAMPLES) return samples;
  const stride = (samples.length - 1) / (PHYSICS_MAX_RENDER_SAMPLES - 1);
  const result: SimulationFrame[] = [];
  let lastIndex = -1;
  for (let index = 0; index < PHYSICS_MAX_RENDER_SAMPLES; index += 1) {
    const sampleIndex = Math.min(samples.length - 1, Math.round(index * stride));
    if (sampleIndex !== lastIndex) result.push(samples[sampleIndex]);
    lastIndex = sampleIndex;
  }
  return result;
}

export function physicsWorldBounds(
  project: PhysicsProject,
  samples: readonly SimulationFrame[],
  frame: SimulationFrame | null,
): PhysicsBounds | null {
  const points: PhysicsPoint[] = [];
  const kind = project.model.kind;
  if (kind === "projectile") {
    points.push({ x: project.model.parameters.initialX, y: project.model.parameters.initialY }, { x: project.model.parameters.initialX, y: 0 });
  } else {
    // The oscillator is drawn as a horizontal spring anchored two metres left
    // of equilibrium; model position.x is displacement from equilibrium.
    points.push({ x: -2, y: 0 }, { x: 0, y: 0 }, { x: project.model.parameters.displacement, y: 0 });
  }
  for (const sample of boundedPhysicsSamples(samples)) {
    const point = toFinitePoint(sample);
    if (point) points.push(point);
  }
  if (frame) {
    const point = toFinitePoint(frame);
    if (point) points.push(point);
  }
  if (points.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  if (kind === "projectile") minY = Math.min(minY, 0);
  const paddingX = Math.max((maxX - minX) * 0.08, 0.35);
  const paddingY = Math.max((maxY - minY) * 0.12, 0.45);
  return {
    minX: Math.max(-MAX_RENDER_COORDINATE, minX - paddingX),
    minY: Math.max(-MAX_RENDER_COORDINATE, minY - paddingY),
    maxX: Math.min(MAX_RENDER_COORDINATE, maxX + paddingX),
    maxY: Math.min(MAX_RENDER_COORDINATE, maxY + paddingY),
  };
}

export function fitPhysicsCamera(
  project: PhysicsProject,
  samples: readonly SimulationFrame[],
  frame: SimulationFrame | null,
  size: PhysicsSize,
  fallback: PhysicsCamera = project.scene.camera,
): PhysicsCamera {
  const normalized = normalizePhysicsSize(size);
  const bounds = physicsWorldBounds(project, samples, frame);
  if (!bounds) return fallback;
  const width = Math.max(0.5, bounds.maxX - bounds.minX);
  const height = Math.max(0.5, bounds.maxY - bounds.minY);
  const margin = Math.min(56, Math.min(normalized.width, normalized.height) * 0.12);
  const availableWidth = Math.max(1, normalized.width - margin * 2);
  const availableHeight = Math.max(1, normalized.height - margin * 2);
  const zoom = clampPhysicsZoom(Math.min(
    availableWidth / (width * (Math.min(normalized.width, normalized.height, 800) / 8)),
    availableHeight / (height * (Math.min(normalized.width, normalized.height, 800) / 8)),
  ));
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    zoom,
  };
}
