import { harmonicWave, lissajous, polarRose } from "@/core/math/curves";
import { presetFor } from "@/core/scenes/presets";
import type { SceneKind } from "@/core/scenes/schema";

/** A deterministic, non-animated mathematical thumbnail for the scene library. */
export function SceneGlyph({ kind }: { kind: SceneKind }) {
  const params = presetFor(kind).params;
  const count = 96;
  const path = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    const point = kind === "lissajous"
      ? lissajous(t * Math.PI * 2, params)
      : kind === "polar-rose"
        ? polarRose(t * Math.PI * 2, params)
        : { x: 2 * t - 1, y: harmonicWave(2 * t - 1, params) };
    const x = 20 + point.x * 15;
    const y = 20 - point.y * 15;
    return (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
  }).join(" ");
  return <svg className="pm-glyph" viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
    <path d={path} stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
