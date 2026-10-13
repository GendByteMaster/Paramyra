import type { PhysicsProject } from "../model/schema";
import type { SimulationFrame } from "../engine/simulation";
import {
  boundedPhysicsSamples,
  normalizePhysicsSize,
  physicsGridStep,
  pixelsPerMeter,
  visiblePhysicsBounds,
  worldToScreen,
  type PhysicsCamera,
  type PhysicsPoint,
  type PhysicsSize,
} from "./geometry";

export type PhysicsPalette = Readonly<{
  background: string;
  grid: string;
  gridMajor: string;
  axis: string;
  text: string;
  muted: string;
  trajectory: string;
  body: string;
  velocity: string;
  force: string;
  spring: string;
  equilibrium: string;
  panel: string;
  panelBorder: string;
}>;

export const DARK_PHYSICS_PALETTE: PhysicsPalette = {
  background: "#0b111a",
  grid: "rgba(151, 176, 207, 0.09)",
  gridMajor: "rgba(151, 176, 207, 0.16)",
  axis: "rgba(187, 207, 233, 0.48)",
  text: "#e7eef8",
  muted: "#a5b4c7",
  trajectory: "#58b9ff",
  body: "#8dc9ff",
  velocity: "#f4c65f",
  force: "#ff8e74",
  spring: "#72d6c5",
  equilibrium: "rgba(183, 200, 222, 0.58)",
  panel: "rgba(16, 25, 37, 0.94)",
  panelBorder: "rgba(184, 205, 234, 0.22)",
};

export const LIGHT_PHYSICS_PALETTE: PhysicsPalette = {
  background: "#f7f9fc",
  grid: "rgba(58, 78, 104, 0.08)",
  gridMajor: "rgba(58, 78, 104, 0.14)",
  axis: "rgba(35, 52, 73, 0.52)",
  text: "#172537",
  muted: "#53677f",
  trajectory: "#087fc2",
  body: "#126fb0",
  velocity: "#9c6b00",
  force: "#bd3e28",
  spring: "#087e70",
  equilibrium: "rgba(53, 72, 96, 0.55)",
  panel: "rgba(255, 255, 255, 0.94)",
  panelBorder: "rgba(51, 73, 101, 0.2)",
};

const MAX_GRID_LINES_PER_AXIS = 220;
const MAX_SCREEN_COORDINATE = 5_000_000;

export function formatPhysicsNumber(value: number, significantDigits = 3): string {
  if (!Number.isFinite(value)) return "—";
  if (Object.is(value, -0) || Math.abs(value) < 0.5 * 10 ** (-significantDigits)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: significantDigits,
    useGrouping: false,
  }).format(value);
}

function validPoint(point: PhysicsPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && Math.abs(point.x) < MAX_SCREEN_COORDINATE && Math.abs(point.y) < MAX_SCREEN_COORDINATE;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color: string, font = "12px ui-monospace, SFMono-Regular, Menlo, monospace"): void {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}

function drawGrid(ctx: CanvasRenderingContext2D, size: PhysicsSize, camera: PhysicsCamera, palette: PhysicsPalette, showGrid: boolean): void {
  const bounds = visiblePhysicsBounds(size, camera);
  const step = physicsGridStep(size, camera);
  if (!(Number.isFinite(step) && step > 0)) return;
  const firstX = Math.ceil(bounds.minX / step) * step;
  const firstY = Math.ceil(bounds.minY / step) * step;
  const countX = Math.min(MAX_GRID_LINES_PER_AXIS, Math.max(0, Math.floor((bounds.maxX - firstX) / step) + 1));
  const countY = Math.min(MAX_GRID_LINES_PER_AXIS, Math.max(0, Math.floor((bounds.maxY - firstY) / step) + 1));
  if (showGrid) {
    ctx.lineWidth = 1;
    for (let i = 0; i < countX; i += 1) {
      const x = firstX + i * step;
      const screen = worldToScreen({ x, y: 0 }, size, camera);
      if (!Number.isFinite(screen.x) || Math.abs(screen.x) > MAX_SCREEN_COORDINATE) continue;
      ctx.strokeStyle = Math.abs(x / step - Math.round(x / step)) < 1e-7 && Math.round(x / step) % 5 === 0 ? palette.gridMajor : palette.grid;
      ctx.beginPath(); ctx.moveTo(screen.x, 0); ctx.lineTo(screen.x, size.height); ctx.stroke();
      if (Math.abs(screen.x - size.width / 2) > 20) text(ctx, formatPhysicsNumber(x, 2), screen.x + 4, size.height / 2 + 14, palette.muted, "11px ui-monospace, SFMono-Regular, Menlo, monospace");
    }
    for (let i = 0; i < countY; i += 1) {
      const y = firstY + i * step;
      const screen = worldToScreen({ x: 0, y }, size, camera);
      if (!Number.isFinite(screen.y) || Math.abs(screen.y) > MAX_SCREEN_COORDINATE) continue;
      ctx.strokeStyle = Math.abs(y / step - Math.round(y / step)) < 1e-7 && Math.round(y / step) % 5 === 0 ? palette.gridMajor : palette.grid;
      ctx.beginPath(); ctx.moveTo(0, screen.y); ctx.lineTo(size.width, screen.y); ctx.stroke();
      if (Math.abs(screen.y - size.height / 2) > 16) text(ctx, formatPhysicsNumber(y, 2), size.width / 2 + 6, screen.y - 9, palette.muted, "11px ui-monospace, SFMono-Regular, Menlo, monospace");
    }
  }

  ctx.strokeStyle = palette.axis;
  ctx.lineWidth = 1.4;
  const xAxis = worldToScreen({ x: 0, y: 0 }, size, camera);
  if (Number.isFinite(xAxis.y) && Math.abs(xAxis.y) < MAX_SCREEN_COORDINATE) {
    ctx.beginPath(); ctx.moveTo(0, xAxis.y); ctx.lineTo(size.width, xAxis.y); ctx.stroke();
  }
  if (Number.isFinite(xAxis.x) && Math.abs(xAxis.x) < MAX_SCREEN_COORDINATE) {
    ctx.beginPath(); ctx.moveTo(xAxis.x, 0); ctx.lineTo(xAxis.x, size.height); ctx.stroke();
  }
  text(ctx, "x (m)", Math.max(8, Math.min(size.width - 48, size.width - 48)), Math.max(12, Math.min(size.height - 16, (Number.isFinite(xAxis.y) ? xAxis.y : size.height - 22) - 16)), palette.muted, "11px ui-sans-serif, system-ui, sans-serif");
  ctx.save();
  ctx.translate(15, 58);
  ctx.rotate(-Math.PI / 2);
  text(ctx, "y (m)", 0, 0, palette.muted, "11px ui-sans-serif, system-ui, sans-serif");
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, from: PhysicsPoint, direction: PhysicsPoint, factor: number, color: string): number {
  const length = Math.hypot(direction.x, direction.y);
  if (!(length > 1e-12 && Number.isFinite(length) && factor > 0)) return 0;
  const px = direction.x * factor;
  const py = -direction.y * factor;
  const magnitudePx = Math.hypot(px, py);
  if (!(Number.isFinite(magnitudePx) && magnitudePx > 1)) return 0;
  const end = { x: from.x + px, y: from.y + py };
  if (!validPoint(from) || !validPoint(end)) return 0;
  const angle = Math.atan2(py, px);
  const head = Math.min(10, Math.max(5, magnitudePx * 0.22));
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.3;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(end.x, end.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath(); ctx.fill();
  return magnitudePx;
}

function vectorFactor(frames: readonly SimulationFrame[], field: "velocity" | "force", size: PhysicsSize): number {
  let max = 0;
  for (const item of frames) {
    const value = Math.hypot(item[field].x, item[field].y);
    if (Number.isFinite(value)) max = Math.max(max, value);
  }
  const length = Math.min(78, Math.max(40, Math.min(size.width, size.height) * 0.18));
  return max > 1e-12 ? length / max : 0;
}

function drawTrajectory(ctx: CanvasRenderingContext2D, size: PhysicsSize, camera: PhysicsCamera, samples: readonly SimulationFrame[], frame: SimulationFrame | null, palette: PhysicsPalette): void {
  const points = boundedPhysicsSamples(samples).map(item => worldToScreen(item.position, size, camera)).filter(validPoint);
  if (frame) {
    const point = worldToScreen(frame.position, size, camera);
    if (validPoint(point) && (points.length === 0 || Math.hypot(points.at(-1)!.x - point.x, points.at(-1)!.y - point.y) > 0.5)) points.push(point);
  }
  if (points.length < 2) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, size.width, size.height); ctx.clip();
  ctx.strokeStyle = palette.trajectory;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, size: PhysicsSize, camera: PhysicsCamera, project: PhysicsProject, frame: SimulationFrame | null, samples: readonly SimulationFrame[], palette: PhysicsPalette): void {
  const parameters = project.model.kind === "projectile" ? project.model.parameters : null;
  if (!parameters) return;
  if (project.scene.showTrail) drawTrajectory(ctx, size, camera, samples, frame, palette);
  const launch = worldToScreen({ x: parameters.initialX, y: parameters.initialY }, size, camera);
  if (validPoint(launch)) {
    ctx.beginPath(); ctx.arc(launch.x, launch.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = palette.text; ctx.fill();
    ctx.beginPath(); ctx.arc(launch.x, launch.y, 7, 0, Math.PI * 2);
    ctx.strokeStyle = palette.text; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (!frame) return;
  const point = worldToScreen(frame.position, size, camera);
  if (!validPoint(point)) return;
  ctx.beginPath(); ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = palette.body; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = palette.background; ctx.stroke();

  if (project.scene.showVectors) {
    const vectorFrames = [...boundedPhysicsSamples(samples), frame];
    const velocityFactor = vectorFactor(vectorFrames, "velocity", size);
    const forceFactor = vectorFactor(vectorFrames, "force", size);
    const velocityLength = drawArrow(ctx, point, frame.velocity, velocityFactor, palette.velocity);
    const forceLength = drawArrow(ctx, point, frame.force, forceFactor, palette.force);
    if (velocityLength) text(ctx, `v ${formatPhysicsNumber(Math.hypot(frame.velocity.x, frame.velocity.y))} m/s`, point.x + 9, point.y - velocityLength * 0.5 - 10, palette.velocity, "600 12px ui-sans-serif, system-ui, sans-serif");
    if (forceLength) text(ctx, `F ${formatPhysicsNumber(Math.hypot(frame.force.x, frame.force.y))} N`, point.x + 9, point.y + forceLength * 0.5 + 12, palette.force, "600 12px ui-sans-serif, system-ui, sans-serif");
  }
}

function drawSpringCoil(ctx: CanvasRenderingContext2D, from: PhysicsPoint, to: PhysicsPoint, palette: PhysicsPalette): void {
  if (!validPoint(from) || !validPoint(to)) return;
  const dx = to.x - from.x;
  const direction = Math.sign(dx) || 1;
  const length = Math.abs(dx);
  const cap = Math.min(12, length * 0.2);
  const coils = Math.max(3, Math.min(14, Math.floor(Math.max(0, length - cap * 2) / 9)));
  const begin = from.x + direction * cap;
  const finish = to.x - direction * cap;
  ctx.strokeStyle = palette.spring;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(begin, from.y);
  if (Math.abs(finish - begin) > 1) {
    for (let index = 0; index <= coils; index += 1) {
      const amount = index / coils;
      const x = begin + (finish - begin) * amount;
      const y = from.y + (index === coils ? 0 : (index % 2 === 0 ? -1 : 1) * 8);
      ctx.lineTo(x, y);
    }
  }
  ctx.lineTo(to.x, to.y); ctx.stroke();
}

function drawSpring(ctx: CanvasRenderingContext2D, size: PhysicsSize, camera: PhysicsCamera, project: PhysicsProject, frame: SimulationFrame | null, palette: PhysicsPalette): void {
  const parameters = project.model.kind === "spring" ? project.model.parameters : null;
  if (!parameters) return;
  const equilibrium = worldToScreen({ x: 0, y: 0 }, size, camera);
  const anchor = worldToScreen({ x: -2, y: 0 }, size, camera);
  const current = frame?.position ?? { x: parameters.displacement, y: 0 };
  const mass = worldToScreen(current, size, camera);
  if (![equilibrium, anchor, mass].every(validPoint)) return;

  ctx.save();
  ctx.setLineDash([5, 5]); ctx.strokeStyle = palette.equilibrium; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(equilibrium.x, 0); ctx.lineTo(equilibrium.x, size.height); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = palette.muted; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(anchor.x - 12, anchor.y - 22); ctx.lineTo(anchor.x - 12, anchor.y + 22); ctx.stroke();
  for (let line = -19; line <= 19; line += 6) {
    ctx.beginPath(); ctx.moveTo(anchor.x - 18, anchor.y + line + 4); ctx.lineTo(anchor.x - 12, anchor.y + line - 4); ctx.stroke();
  }
  drawSpringCoil(ctx, { x: anchor.x - 12, y: anchor.y }, mass, palette);
  ctx.fillStyle = palette.body;
  roundedRect(ctx, mass.x - 13, mass.y - 13, 26, 26, 5);
  ctx.fill(); ctx.strokeStyle = palette.background; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = palette.text;
  ctx.beginPath(); ctx.arc(equilibrium.x, equilibrium.y, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  text(ctx, "equilibrium", equilibrium.x + 8, Math.max(16, equilibrium.y - 24), palette.muted, "11px ui-sans-serif, system-ui, sans-serif");
  const displacement = current.x;
  if (Math.abs(displacement) > 1e-9) {
    const endX = mass.x;
    const startX = equilibrium.x;
    const y = mass.y + 25;
    ctx.strokeStyle = palette.spring; ctx.fillStyle = palette.spring; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    const sign = Math.sign(endX - startX);
    for (const x of [startX, endX]) {
      const direction = x === startX ? sign : -sign;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + direction * 6, y - 4); ctx.lineTo(x + direction * 6, y + 4); ctx.closePath(); ctx.fill();
    }
    text(ctx, `x ${formatPhysicsNumber(displacement)} m`, Math.min(startX, endX) + Math.abs(endX - startX) / 2 + 6, y + 12, palette.spring, "600 12px ui-sans-serif, system-ui, sans-serif");
  }
}

function drawLegend(ctx: CanvasRenderingContext2D, size: PhysicsSize, palette: PhysicsPalette, frame: SimulationFrame | null, samples: readonly SimulationFrame[], project: PhysicsProject): void {
  const rows: { label: string; color: string }[] = [];
  if (project.model.kind === "projectile" && project.scene.showTrail) rows.push({ label: "Path", color: palette.trajectory });
  if (project.scene.showVectors && frame) {
    const vectorFrames = [...boundedPhysicsSamples(samples), frame];
    const velocityFactor = vectorFactor(vectorFrames, "velocity", size);
    const forceFactor = vectorFactor(vectorFrames, "force", size);
    const velocityScale = velocityFactor > 0 ? `v · 1 m/s = ${formatPhysicsNumber(velocityFactor, 2)} px` : "v · 0 m/s";
    const forceScale = forceFactor > 0 ? `F · 1 N = ${formatPhysicsNumber(forceFactor, 2)} px` : "F · 0 N";
    rows.push({ label: velocityScale, color: palette.velocity }, { label: forceScale, color: palette.force });
  }
  if (project.model.kind === "spring") rows.push({ label: "Displacement x", color: palette.spring });
  if (rows.length === 0) return;
  const availableWidth = Math.max(1, size.width - 24);
  const width = Math.min(availableWidth, Math.max(178, ...rows.map(row => row.label.length * 6.15 + 42)));
  const height = rows.length * 22 + 18;
  const x = Math.max(0, size.width - width - 8);
  const y = Math.max(8, size.width < 470 ? Math.min(64, size.height - height - 54) : size.height - height - 14);
  roundedRect(ctx, x, y, width, height, 9);
  ctx.fillStyle = palette.panel; ctx.fill(); ctx.strokeStyle = palette.panelBorder; ctx.lineWidth = 1; ctx.stroke();
  rows.forEach((row, index) => {
    const rowY = y + 13 + index * 22;
    ctx.strokeStyle = row.color; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x + 11, rowY); ctx.lineTo(x + 25, rowY); ctx.stroke();
    text(ctx, row.label, x + 32, rowY, palette.text, "11px ui-sans-serif, system-ui, sans-serif");
  });
}

function drawReadout(ctx: CanvasRenderingContext2D, size: PhysicsSize, palette: PhysicsPalette, frame: SimulationFrame | null): void {
  if (!frame) return;
  const position = `x ${formatPhysicsNumber(frame.position.x)} m   y ${formatPhysicsNumber(frame.position.y)} m`;
  const time = `t ${formatPhysicsNumber(frame.time)} s  ·  step ${frame.step}`;
  const maxWidth = Math.max(0, Math.min(size.width - 24, Math.max(position.length, time.length) * 7 + 26));
  const x = Math.min(12, size.width);
  const y = Math.max(10, size.height - 52);
  roundedRect(ctx, x, y, maxWidth, 40, 8);
  ctx.fillStyle = palette.panel; ctx.fill(); ctx.strokeStyle = palette.panelBorder; ctx.lineWidth = 1; ctx.stroke();
  text(ctx, time, x + 10, y + 12, palette.text, "11px ui-monospace, SFMono-Regular, Menlo, monospace");
  text(ctx, position, x + 10, y + 28, palette.muted, "11px ui-monospace, SFMono-Regular, Menlo, monospace");
}

export function drawPhysicsScene(
  ctx: CanvasRenderingContext2D,
  size: PhysicsSize,
  project: PhysicsProject,
  frame: SimulationFrame | null,
  samples: readonly SimulationFrame[],
  camera: PhysicsCamera,
  palette: PhysicsPalette = DARK_PHYSICS_PALETTE,
): void {
  const normalized = normalizePhysicsSize(size);
  ctx.clearRect(0, 0, normalized.width, normalized.height);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, normalized.width, normalized.height);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, normalized.width, normalized.height); ctx.clip();
  drawGrid(ctx, normalized, camera, palette, project.scene.showGrid);
  if (project.model.kind === "projectile") drawProjectile(ctx, normalized, camera, project, frame, samples, palette);
  else drawSpring(ctx, normalized, camera, project, frame, palette);
  ctx.restore();
  drawReadout(ctx, normalized, palette, frame);
  drawLegend(ctx, normalized, palette, frame, samples, project);
}

export function vectorPixelsPerUnit(frames: readonly SimulationFrame[], field: "velocity" | "force", size: PhysicsSize): number {
  return vectorFactor(frames, field, normalizePhysicsSize(size));
}

export function physicsViewScale(size: PhysicsSize, camera: PhysicsCamera): number {
  return pixelsPerMeter(size, camera);
}
