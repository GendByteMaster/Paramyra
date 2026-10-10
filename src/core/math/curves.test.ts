import { describe, expect, it } from "vitest";
import { harmonicWave, lissajous, polarRose } from "./curves";
import { presets } from "../scenes/presets";
import { sceneSchema } from "../scenes/schema";

describe("deterministic math core", () => {
  it("returns the same coordinates for the same inputs", () => {
    const params = presets[0].params;
    expect(lissajous(1.2, params, 4)).toEqual(lissajous(1.2, params, 4));
  });
  it("keeps all sample values finite", () => {
    const params = presets[1].params;
    for (let t = 0; t < Math.PI * 2; t += 0.1) {
      const point = polarRose(t, params);
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      expect(Number.isFinite(harmonicWave(t, params))).toBe(true);
    }
  });
  it("rejects executable strings and out-of-range parameters", () => {
    const hostile = { ...presets[0], params: { ...presets[0].params, frequencyX: 999, eval: "alert(1)" } };
    expect(sceneSchema.safeParse(hostile).success).toBe(false);
  });
});
