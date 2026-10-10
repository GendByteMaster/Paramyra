import type { SceneParams } from "../scenes/schema";

export type Point = Readonly<{ x: number; y: number }>;

export function lissajous(t: number, params: SceneParams, time = 0): Point {
  return {
    x: params.amplitude * Math.sin(params.frequencyX * t + params.phase + time * 0.28),
    y: params.amplitude * Math.sin(params.frequencyY * t),
  };
}

export function polarRose(t: number, params: SceneParams, time = 0): Point {
  const r = params.amplitude * Math.cos(params.frequencyX * t);
  const a = t + params.phase + time * 0.14;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

export function harmonicWave(x: number, params: SceneParams, time = 0): number {
  return params.amplitude * 0.65 * (
    Math.sin(params.frequencyX * Math.PI * x + params.phase + time) * 0.75 +
    Math.sin(params.frequencyY * Math.PI * x - time * 0.57) * 0.25
  );
}
