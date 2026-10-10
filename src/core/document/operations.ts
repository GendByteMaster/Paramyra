import { layerById, type MathDocument, type MathLayer } from "./schema";

export function updateLayer(doc: MathDocument, id: string, fn: (layer: MathLayer) => MathLayer): MathDocument {
  if (!doc.layers.some(layer => layer.id === id)) return doc;
  return { ...doc, layers: doc.layers.map(layer => layer.id === id ? fn(layer) : layer) };
}
export function addLayer(doc: MathDocument, layer: MathLayer): MathDocument {
  if (doc.layers.length >= 12 || doc.layers.some(other => other.id === layer.id)) return doc;
  return { ...doc, layers: [...doc.layers, layer] };
}
export function removeLayer(doc: MathDocument, id: string): MathDocument {
  if (doc.layers.length <= 1 || !doc.layers.some(layer => layer.id === id)) return doc;
  return { ...doc, layers: doc.layers.filter(layer => layer.id !== id) };
}
export function moveLayer(doc: MathDocument, id: string, direction: -1 | 1): MathDocument {
  const from = doc.layers.findIndex(layer => layer.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= doc.layers.length) return doc;
  const layers = [...doc.layers];
  [layers[from], layers[to]] = [layers[to], layers[from]];
  return { ...doc, layers };
}
export function duplicateLayer(doc: MathDocument, id: string, newId: string): MathDocument {
  if (doc.layers.length >= 12) return doc;
  const source = layerById(doc, id);
  if (!doc.layers.some(layer => layer.id === id) || doc.layers.some(layer => layer.id === newId)) return doc;
  const index = doc.layers.findIndex(layer => layer.id === id);
  return { ...doc, layers: [
    ...doc.layers.slice(0, index + 1),
    { ...source, id: newId, title: (source.title + " copy").slice(0, 120), params: { ...source.params }, offset: { ...source.offset } },
    ...doc.layers.slice(index + 1),
  ] };
}
