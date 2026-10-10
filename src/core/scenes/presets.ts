import type { SceneDocument } from "./schema";

export const presets: readonly SceneDocument[] = [
  {
    schemaVersion: 1, id: "lissajous", kind: "lissajous", title: "Lissajous Curves",
    params: { frequencyX: 3, frequencyY: 4, phase: 0.65, amplitude: 0.84, strokeWidth: 1.6 },
  },
  {
    schemaVersion: 1, id: "polar-rose", kind: "polar-rose", title: "Polar Rose",
    params: { frequencyX: 5, frequencyY: 2, phase: 0.2, amplitude: 0.9, strokeWidth: 1.6 },
  },
  {
    schemaVersion: 1, id: "wave", kind: "wave", title: "Harmonic Waves",
    params: { frequencyX: 3, frequencyY: 2, phase: 0.35, amplitude: 0.78, strokeWidth: 2 },
  },
];

export function presetFor(kind: SceneDocument["kind"]): SceneDocument {
  return presets.find((scene) => scene.kind === kind) ?? presets[0];
}
