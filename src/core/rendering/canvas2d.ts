import { harmonicWave, lissajous, polarRose } from "../math/curves";
import type { SceneDocument } from "../scenes/schema";

export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, scene: SceneDocument, time: number) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#080e1a";
  ctx.fillRect(0, 0, width, height);
  const spacing = 30;
  ctx.strokeStyle = "rgba(151,168,202,.065)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = width / 2 % spacing; x < width; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = height / 2 % spacing; y < height; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.strokeStyle = "#33435f";
  ctx.beginPath();
  ctx.moveTo(-width / 2, 0); ctx.lineTo(width / 2, 0);
  ctx.moveTo(0, -height / 2); ctx.lineTo(0, height / 2);
  ctx.stroke();

  const radius = Math.min(width, height) * 0.43;
  ctx.lineWidth = scene.params.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = 13;
  ctx.shadowColor = "#8c98ff";
  ctx.strokeStyle = "#a5b4fc";
  ctx.beginPath();

  if (scene.kind === "wave") {
    const count = 640;
    for (let i = 0; i <= count; i++) {
      const x = i / count * 2 - 1;
      const y = harmonicWave(x, scene.params, time);
      if (i === 0) ctx.moveTo(x * width * 0.46, -y * radius);
      else ctx.lineTo(x * width * 0.46, -y * radius);
    }
  } else {
    const points = 1000;
    const curve = scene.kind === "lissajous" ? lissajous : polarRose;
    // A rose with an integer k traces all petals over 2π; Lissajous also closes here.
    for (let i = 0; i <= points; i++) {
      const point = curve(i / points * Math.PI * 2, scene.params, time);
      if (i === 0) ctx.moveTo(point.x * radius, -point.y * radius);
      else ctx.lineTo(point.x * radius, -point.y * radius);
    }
  }
  ctx.stroke();
  ctx.restore();
}
