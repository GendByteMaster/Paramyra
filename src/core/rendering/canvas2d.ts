import { gridStep, layerWorldPoint, pixelScale, screenToWorld, worldToScreen, type Size } from "./geometry";
import type { SceneDocument } from "../scenes/schema";
import { documentFromScene, type MathDocument, type MathLayer } from "../document/schema";
import { resolveAnimatedDocument } from "../animation/keyframes";

export type CanvasView = {
  zoom: number;
  pan: { x: number; y: number };
  grid: boolean;
  axes: boolean;
  style: "glow" | "clean";
  selectedLayerId?: string;
};

export const defaultView: CanvasView = {
  zoom: 1, pan: { x: 0, y: 0 }, grid: true, axes: true, style: "glow",
};

/** The renderer accepts explicit time in seconds. There is no frame-dependent physics state. */
export function drawDocument(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  doc: MathDocument,
  time: number,
  view: CanvasView = defaultView,
  transparent = false,
): void {
  if (width <= 0 || height <= 0 || !Number.isFinite(width * height * time)) return;

  ctx.clearRect(0, 0, width, height);
  if (!transparent) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#090e17");
  bg.addColorStop(0.58, "#0b1321");
  bg.addColorStop(1, "#080d16");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  }

  const renderedDoc = resolveAnimatedDocument(doc,time);
  const size: Size = { width, height };
  const visibleCount = renderedDoc.layers.filter(layer => layer.visible && layer.opacity > 0).length;
  const sampleBudget = Math.max(320, Math.floor(10_000 / Math.max(1, visibleCount)));
  drawGrid(ctx, size, view);
  for (const layer of renderedDoc.layers) {
    if (!layer.visible || layer.opacity === 0) continue;
    drawLayer(ctx, size, layer, time, view, sampleBudget);
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, size: Size, view: CanvasView): void {
  if (!view.grid && !view.axes) return;
  const { width, height } = size;
  const scale = pixelScale(size, view.zoom);
  const origin = worldToScreen({ x: 0, y: 0 }, size, view);
  if (view.grid) {
    const step = gridStep(size, view.zoom);
    const left = screenToWorld({ x: 0, y: height }, size, view).x;
    const right = screenToWorld({ x: width, y: 0 }, size, view).x;
    const bottom = screenToWorld({ x: 0, y: height }, size, view).y;
    const top = screenToWorld({ x: width, y: 0 }, size, view).y;
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(146,174,213,.10)";
    for (let x = Math.ceil(left / step); x <= Math.floor(right / step); x++) {
      const px = Math.round(origin.x + x * step * scale) + .5;
      ctx.moveTo(px, 0); ctx.lineTo(px, height);
    }
    for (let y = Math.ceil(bottom / step); y <= Math.floor(top / step); y++) {
      const py = Math.round(origin.y - y * step * scale) + .5;
      ctx.moveTo(0, py); ctx.lineTo(width, py);
    }
    ctx.stroke();
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "rgba(156,185,226,.67)";
    const axisY = Math.min(height - 8, Math.max(13, origin.y + 14));
    const axisX = Math.min(width - 38, Math.max(6, origin.x + 7));
    for (let x = Math.ceil(left / step); x <= Math.floor(right / step); x++) {
      if (!x) continue;
      const px = origin.x + x * step * scale;
      if (px >= 4 && px < width - 34) ctx.fillText(Number((x * step).toPrecision(5)).toString(), px + 3, axisY);
    }
    for (let y = Math.ceil(bottom / step); y <= Math.floor(top / step); y++) {
      if (!y) continue;
      const py = origin.y - y * step * scale;
      if (py >= 12 && py < height - 3) ctx.fillText(Number((y * step).toPrecision(5)).toString(), axisX, py - 3);
    }
  }
  if (view.axes) {
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(159,185,224,.4)";
    ctx.moveTo(Math.round(origin.x) + .5, 0);
    ctx.lineTo(Math.round(origin.x) + .5, height);
    ctx.moveTo(0, Math.round(origin.y) + .5);
    ctx.lineTo(width, Math.round(origin.y) + .5);
    ctx.stroke();
  }
}

function drawLayer(
  ctx: CanvasRenderingContext2D, size: Size, layer: MathLayer, time: number, view: CanvasView, budget: number,
): void {
  const n = Math.max(320, Math.min(budget, 2000, Math.ceil(pixelScale(size, view.zoom) * 2.5)));
  ctx.save();
  ctx.beginPath();
  let previous: { x: number; y: number } | null = null;
  for (let i = 0; i <= n; i++) {
    const world = layerWorldPoint(layer, i / n, time, size);
    if (!Number.isFinite(world.x + world.y) || Math.abs(world.x) > 100 || Math.abs(world.y) > 100) {
      previous = null;
      continue;
    }
    const screen = worldToScreen(world, size, view);
    if (!previous || Math.hypot(screen.x - previous.x, screen.y - previous.y) > Math.max(size.width, size.height) * 1.5) {
      ctx.moveTo(screen.x, screen.y);
    } else ctx.lineTo(screen.x, screen.y);
    previous = screen;
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = layer.color;
  if (view.style === "glow") {
    ctx.save();
    ctx.globalAlpha = layer.opacity * .28;
    ctx.shadowColor = layer.color;
    ctx.shadowBlur = 9;
    ctx.lineWidth = layer.params.strokeWidth * 2.4;
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = layer.opacity;
  ctx.lineWidth = Math.max(1, layer.params.strokeWidth);
  ctx.stroke();
  if (view.selectedLayerId === layer.id) {
    ctx.globalAlpha = 0.22 * layer.opacity;
    ctx.lineWidth = Math.max(3, layer.params.strokeWidth + 5);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
  ctx.restore();
}

/** Compatibility wrapper for the public v1 scene gallery. */
export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, scene: SceneDocument, time: number, zoom = 1): void {
  drawDocument(ctx, width, height, documentFromScene(scene), time, { ...defaultView, zoom });
}
