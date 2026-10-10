import { harmonicWave, lissajous, polarRose } from "../math/curves";
import type { MathDocument, MathLayer } from "../document/schema";

export type Size = Readonly<{ width: number; height: number }>;
export type Vec2 = Readonly<{ x: number; y: number }>;
export type Camera = Readonly<{ zoom: number; pan: Vec2 }>;
export type Bounds = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
const SAMPLES = 640;

export function clampZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) : 1;
}

export function baseRadius(size: Size): number {
  return Math.max(1, Math.min(size.width, size.height) * 0.45);
}

export function pixelScale(size: Size, zoom: number): number {
  return baseRadius(size) * clampZoom(zoom);
}

/** All mathematical models share one world coordinate system: +Y is up. */
export function sampleLayer(layer: MathLayer, t: number, time: number, size: Size): Vec2 {
  const p = layer.params;
  if (layer.kind === "wave") {
    const x = 2 * t - 1;
    return { x: x * (size.width * 0.46) / baseRadius(size),
      y: harmonicWave(x, p, time) };
  }
  return layer.kind === "lissajous"
    ? lissajous(t * Math.PI * 2, p, time)
    : polarRose(t * Math.PI * 2, p, time);
}

export function worldToScreen(world: Vec2, size: Size, view: Camera): Vec2 {
  const scale = pixelScale(size, view.zoom);
  return {
    x: size.width / 2 + view.pan.x + world.x * scale,
    y: size.height / 2 + view.pan.y - world.y * scale,
  };
}

export function screenToWorld(screen: Vec2, size: Size, view: Camera): Vec2 {
  const scale = pixelScale(size, view.zoom);
  return {
    x: (screen.x - size.width / 2 - view.pan.x) / scale,
    y: -(screen.y - size.height / 2 - view.pan.y) / scale,
  };
}

export function layerWorldPoint(layer: MathLayer, t: number, time: number, size: Size): Vec2 {
  const p = sampleLayer(layer, t, time, size);
  return { x: p.x + layer.offset.x, y: p.y + layer.offset.y };
}

export function visibleBounds(doc: MathDocument, time: number, size: Size): Bounds | null {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  if (!(size.width > 0 && size.height > 0) || !Number.isFinite(time)) return null;
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    for (let i = 0; i <= SAMPLES; i++) {
      const p = layerWorldPoint(layer, i / SAMPLES, time, size);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** Fit measured geometry; retain grid/axes/style in the caller's view. */
export function fitCamera(doc: MathDocument, time: number, size: Size, previous: Camera): Camera {
  const bounds = visibleBounds(doc, time, size);
  if (!bounds) return previous;
  const w = Math.max(0.08, bounds.maxX - bounds.minX);
  const h = Math.max(0.08, bounds.maxY - bounds.minY);
  const margin = 36;
  const r = baseRadius(size);
  const availableW = Math.max(1, size.width - margin * 2);
  const availableH = Math.max(1, size.height - margin * 2);
  const zoom = clampZoom(Math.min(availableW / (w * r), availableH / (h * r)));
  return {
    zoom,
    pan: {
      x: -((bounds.minX + bounds.maxX) / 2) * r * zoom,
      y: ((bounds.minY + bounds.maxY) / 2) * r * zoom,
    },
  };
}

/** Keep the world point under the pointer fixed when wheel-zooming. */
export function zoomAt(screen: Vec2, size: Size, previous: Camera, zoom: number): Camera {
  const next = clampZoom(zoom);
  const ratio = next / clampZoom(previous.zoom);
  return {
    zoom: next,
    pan: {
      x: screen.x - size.width / 2 - (screen.x - size.width / 2 - previous.pan.x) * ratio,
      y: screen.y - size.height / 2 - (screen.y - size.height / 2 - previous.pan.y) * ratio,
    },
  };
}

/** Grid interval in mathematical units; 1/2/5 decades stay readable at any zoom. */
export function gridStep(size: Size, zoom: number): number {
  const target = 85 / pixelScale(size, zoom);
  const power = Math.pow(10, Math.floor(Math.log10(target)));
  return [1, 2, 5, 10].map(n => n * power).find(v => v >= target) ?? power * 10;
}

function segmentDistanceSquared(p: Vec2, a: Vec2, b: Vec2): number {
  const vx = b.x - a.x, vy = b.y - a.y;
  const length = vx * vx + vy * vy;
  const u = length ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / length)) : 0;
  const dx = p.x - (a.x + vx * u), dy = p.y - (a.y + vy * u);
  return dx * dx + dy * dy;
}

/** Check topmost visible stroke first; no invisible bounding-box selection. */
export function hitTestLayer(doc: MathDocument, time: number, size: Size, view: Camera, screen: Vec2): string | null {
  if (!Number.isFinite(screen.x + screen.y) || !(size.width > 0 && size.height > 0)) return null;
  for (let index = doc.layers.length - 1; index >= 0; index--) {
    const layer = doc.layers[index];
    if (!layer.visible || layer.opacity <= 0) continue;
    const threshold = Math.max(10, layer.params.strokeWidth * 2 + 6);
    let previous = worldToScreen(layerWorldPoint(layer, 0, time, size), size, view);
    for (let i = 1; i <= SAMPLES; i++) {
      const current = worldToScreen(layerWorldPoint(layer, i / SAMPLES, time, size), size, view);
      if (segmentDistanceSquared(screen, previous, current) <= threshold * threshold) return layer.id;
      previous = current;
    }
  }
  return null;
}
