import { describe, expect, it } from "vitest";
import { presets } from "../scenes/presets";
import { documentFromScene, parseDocument, layerFromScene } from "./schema";
import { addLayer, duplicateLayer, moveLayer, removeLayer, updateLayer } from "./operations";
import { initializeHistory, commitDocument, undoDocument, redoDocument, HISTORY_LIMIT } from "./history";

describe("SceneDocument v2", () => {
  it("migrates exact v1 documents, preserving mathematical parameters", () => {
    const scene = presets[0];
    const migrated = parseDocument(scene)!;
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.layers).toHaveLength(1);
    expect(migrated.layers[0].params).toEqual(scene.params);
    expect(parseDocument(migrated)).toEqual(migrated);
  });
  it("rejects malformed, hostile, oversized and duplicate layer input", () => {
    const doc = documentFromScene(presets[0]);
    expect(parseDocument({ ...doc, layers: Array(13).fill(doc.layers[0]) })).toBeNull();
    expect(parseDocument({ ...doc, layers: [doc.layers[0], doc.layers[0]] })).toBeNull();
    expect(parseDocument({ ...doc, duration: Infinity })).toBeNull();
    expect(parseDocument({ ...doc, arbitraryScript: "eval(1)" })).toBeNull();
    expect(parseDocument({ ...doc, layers: [{ ...doc.layers[0], color: "url(javascript:1)" }] })).toBeNull();
    expect(parseDocument({ ...presets[0], evil: "x" })).toBeNull();
  });
  it("supports layer operations without mutating source", () => {
    const first = documentFromScene(presets[0]);
    const other = layerFromScene(presets[1], "second");
    const added = addLayer(first, other);
    expect(first.layers).toHaveLength(1);
    const renamed = updateLayer(added, "second", layer => ({ ...layer, title: "Renamed" }));
    expect(renamed.layers[1].title).toBe("Renamed");
    expect(added.layers[1].title).toBe("Polar Rose");
    const cloned = duplicateLayer(renamed, "second", "third");
    expect(cloned.layers).toHaveLength(3);
    expect(moveLayer(cloned, "third", -1).layers[1].id).toBe("third");
    expect(removeLayer(cloned, "second").layers).toHaveLength(2);
    expect(removeLayer(first, first.layers[0].id)).toBe(first);
  });
  it("provides bounded undo/redo with explicit coalescing", () => {
    const start = documentFromScene(presets[0]);
    const one = { ...start, title: "One" };
    const two = { ...start, title: "Two" };
    let history = commitDocument(initializeHistory(start), one);
    history = commitDocument(history, two, true);
    expect(history.past).toHaveLength(1);
    history = undoDocument(history);
    expect(history.present).toEqual(start);
    history = redoDocument(history);
    expect(history.present.title).toBe("Two");
    for (let i = 0; i < 90; i++) history = commitDocument(history, { ...history.present, title: String(i) });
    expect(history.past.length).toBe(HISTORY_LIMIT);
  });
});
