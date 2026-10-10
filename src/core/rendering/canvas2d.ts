import { harmonicWave, lissajous, polarRose } from "../math/curves";
import type { SceneDocument } from "../scenes/schema";
import { documentFromScene, type MathDocument, type MathLayer } from "../document/schema";

export type CanvasView = {
  zoom: number;
  pan: { x: number; y: number };
  grid: boolean;
  axes: boolean;
  style: "glow" | "clean";
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
): void {
  if (width <= 0 || height <= 0 || !Number.isFinite(width * height * time)) return;

  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#090e17");
  bg.addColorStop(0.58, "#0b1321");
  bg.addColorStop(1, "#080d16");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Grid remains axis-aligned, displaced by the user's pan in CSS pixels.
  const step = 36;
  if (view.grid) {
    const ox = ((width / 2 + view.pan.x) % step + step) % step;
    const oy = ((height / 2 + view.pan.y) % step + step) % step;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(146,174,213,.047)";
    ctx.beginPath();
    for (let x = ox; x < width; x += step) {
      ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, height);
    }
    for (let y = oy; y < height; y += step) {
      ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(width, Math.round(y) + .5);
    }
    ctx.stroke();
  }
  const cx = width / 2 + view.pan.x;
  const cy = height / 2 + view.pan.y;
  if (view.axes) {
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(159,185,224,.25)";
    ctx.moveTo(Math.round(cx) + .5, 0); ctx.lineTo(Math.round(cx) + .5, height);
    ctx.moveTo(0, Math.round(cy) + .5); ctx.lineTo(width, Math.round(cy) + .5);
    ctx.stroke();
  }
  const r = Math.min(width, height) * .45 * view.zoom;
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity === 0) continue;
    drawLayer(ctx, width, r, cx, cy, layer, time, view.style, view.zoom);
  }
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  radius: number,
  cx: number,
  cy: number,
  layer: MathLayer,
  time: number,
  style: CanvasView["style"],
  zoom: number,
): void {
  const n = Math.max(768, Math.min(2200, Math.ceil(radius * 3)));
  ctx.save();
  ctx.translate(cx + layer.offset.x * radius, cy - layer.offset.y * radius);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = layer.kind === "lissajous"
      ? lissajous(t * Math.PI * 2, layer.params, time)
      : layer.kind === "polar-rose"
        ? polarRose(t * Math.PI * 2, layer.params, time)
        : { x: 2*t-1, y: harmonicWave(2*t-1, layer.params, time) };
    const x = layer.kind === "wave" ? (2*t-1) * width * .46 * zoom : p.x * radius;
    const y = -p.y * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = layer.color;
  if (style === "glow") {
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
  ctx.restore();
}

/** Compatibility wrapper for the public v1 scene gallery. */
export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, scene: SceneDocument, time: number, zoom = 1): void {
  drawDocument(ctx, width, height, documentFromScene(scene), time, { ...defaultView, zoom });
}
