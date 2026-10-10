import { harmonicWave, lissajous, polarRose } from "../math/curves";
import type { SceneDocument } from "../scenes/schema";

/**
 * Deterministic Canvas 2D renderer.
 * CSS pixels are the coordinate space; the host SceneCanvas supplies its DPR transform.
 * No React dependencies, independently testable and suitable for future render adapters.
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: SceneDocument,
  time: number,
  zoom = 1,
): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const shortest = Math.min(width, height);
  const grid = 36;

  ctx.clearRect(0, 0, width, height);
  const backdrop = ctx.createLinearGradient(0, 0, width, height);
  backdrop.addColorStop(0, "#091322");
  backdrop.addColorStop(0.55, "#07111f");
  backdrop.addColorStop(1, "#080d18");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);

  // Crisp grid at CSS-pixel boundaries, with stronger 5th intervals.
  for (let x = width / 2 % grid, n = 0; x <= width; x += grid, n++) {
    const major = n % 5 === 0;
    ctx.beginPath();
    ctx.strokeStyle = major ? "rgba(151, 184, 239, .085)" : "rgba(151, 184, 239, .039)";
    ctx.lineWidth = 1;
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
    ctx.stroke();
  }
  for (let y = height / 2 % grid, n = 0; y <= height; y += grid, n++) {
    const major = n % 5 === 0;
    ctx.beginPath();
    ctx.strokeStyle = major ? "rgba(151, 184, 239, .085)" : "rgba(151, 184, 239, .039)";
    ctx.lineWidth = 1;
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
    ctx.stroke();
  }

  const centerX = Math.round(width / 2) + 0.5;
  const centerY = Math.round(height / 2) + 0.5;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(135, 172, 234, .25)";
  ctx.lineWidth = 1;
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, height);
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();

  // Keep geometry centered and leave space around the longest curve at 100% zoom.
  const radius = shortest * 0.465 * zoom;
  const count = Math.max(768, Math.min(2200, Math.ceil(shortest * 1.4)));
  const point = scene.kind === "lissajous" ? lissajous : polarRose;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.beginPath();
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const coordinate = scene.kind === "wave"
      ? { x: (2 * t - 1) * width * 0.46 * zoom, y: -harmonicWave(2 * t - 1, scene.params, time) * radius }
      : point(t * Math.PI * 2, scene.params, time);
    const x = scene.kind === "wave" ? coordinate.x : coordinate.x * radius;
    const y = scene.kind === "wave" ? coordinate.y : -coordinate.y * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  const color = scene.kind === "polar-rose" ? "#80e3db" : scene.kind === "wave" ? "#90c8ff" : "#a9b8ff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;

  // Two restrained passes are clearer on high-DPI screens than a large one-pass glow.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = scene.params.strokeWidth * 2.4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();

  ctx.globalAlpha = 0.98;
  ctx.lineWidth = Math.max(1.05, scene.params.strokeWidth);
  ctx.stroke();
  ctx.restore();
}
