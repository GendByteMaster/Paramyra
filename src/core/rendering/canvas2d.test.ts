import { describe, expect, it, vi } from "vitest";
import { documentFromScene } from "../document/schema";
import { presets } from "../scenes/presets";
import { drawDocument, defaultView } from "./canvas2d";

describe("multi-layer deterministic renderer", () => {
  it("draws only visible layers and honors overlay settings", () => {
    const base = documentFromScene(presets[0]);
    const doc = { ...base, layers: [{ ...base.layers[0], visible: false }] };
    const ctx = {
      clearRect: vi.fn(), fillRect: vi.fn(), createLinearGradient: () => ({ addColorStop: vi.fn() }),
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    drawDocument(ctx, 500, 400, doc, 2, { ...defaultView, grid: false, axes: false });
    expect(ctx.clearRect).toHaveBeenCalledOnce();
    expect(ctx.stroke).not.toHaveBeenCalled();
    drawDocument(ctx, 500, 400, base, 2, { ...defaultView, grid: false, axes: false });
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
