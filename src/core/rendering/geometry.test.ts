import { describe, expect, it } from "vitest";
import { documentFromScene } from "../document/schema";
import { presets } from "../scenes/presets";
import { fitCamera, gridStep, hitTestLayer, layerWorldPoint, pixelScale, screenToWorld, worldToScreen, zoomAt } from "./geometry";

const size = { width: 800, height: 600 };
const document = documentFromScene(presets[0]);

describe("professional canvas world geometry", () => {
  it("round-trips world coordinates with pan and zoom", () => {
    const view = { zoom: 1.75, pan: { x: 44, y: -32 } };
    const world = { x: 1.3, y: -.72 };
    const screen = worldToScreen(world, size, view);
    const result = screenToWorld(screen, size, view);
    expect(result.x).toBeCloseTo(world.x);
    expect(result.y).toBeCloseTo(world.y);
  });

  it("keeps the point under the cursor fixed during zoom", () => {
    const view = { zoom: 1, pan: { x: 95, y: -30 } };
    const cursor = { x: 211, y: 410 };
    const before = screenToWorld(cursor, size, view);
    const after = screenToWorld(cursor, size, zoomAt(cursor, size, view, 2));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("fits every visible offset layer inside the viewport margin", () => {
    const original = document.layers[0];
    const second = { ...original, id: "second", offset: { x: 2, y: -2 } };
    const doc = { ...document, layers: [original, second] };
    const view = fitCamera(doc, 0, size, { zoom: 1, pan: { x: 0, y: 0 } });
    for (const layer of doc.layers) {
      for (let i = 0; i <= 100; i++) {
        const screen = worldToScreen(layerWorldPoint(layer, i / 100, 0, size), size, view);
        expect(screen.x).toBeGreaterThanOrEqual(34);
        expect(screen.x).toBeLessThanOrEqual(size.width - 34);
        expect(screen.y).toBeGreaterThanOrEqual(34);
        expect(screen.y).toBeLessThanOrEqual(size.height - 34);
      }
    }
  });

  it("selects the highest visible curve but excludes hidden curves", () => {
    const layer = document.layers[0];
    const doc = { ...document, layers: [layer, { ...layer, id: "top" }] };
    const view = { zoom: 1, pan: { x: 0, y: 0 } };
    const point = worldToScreen(layerWorldPoint(layer, 0, 0, size), size, view);
    expect(hitTestLayer(doc, 0, size, view, point)).toBe("top");
    expect(hitTestLayer({ ...doc, layers: [layer, { ...doc.layers[1], visible: false }] }, 0, size, view, point)).toBe(layer.id);
    expect(hitTestLayer(doc, 0, size, view, { x: -1000, y: -1000 })).toBeNull();
  });

  it("keeps the grid in world coordinates at any zoom", () => {
    for (const zoom of [0.1, 0.5, 1, 3, 8]) {
      const px = gridStep(size, zoom) * pixelScale(size, zoom);
      expect(px).toBeGreaterThanOrEqual(85);
      expect(px).toBeLessThan(500);
    }
  });
});
