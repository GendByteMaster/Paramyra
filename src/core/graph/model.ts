import { z } from "zod";
import { propertyBounds, supportsProperty, type AnimatableProperty } from "@/core/animation/keyframes";
import type { MathDocument, MathLayer } from "@/core/document/schema";

export const GRAPH_KEY = "paramyra.nodegraph.v1";
export const GRAPH_NODE_LIMIT = 32;
export const GRAPH_EDGE_LIMIT = 64;
export const GRAPH_KINDS = ["constant", "time", "add", "multiply", "sine", "output"] as const;
export type GraphKind = typeof GRAPH_KINDS[number];
export type GraphPort = "a" | "b" | "in";
export const TARGET_PROPERTIES = ["opacity", "offset.x", "offset.y", "params.strokeWidth",
  "formula.a", "formula.b", "formula.c"] as const satisfies readonly AnimatableProperty[];

const nodeSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(GRAPH_KINDS),
  title: z.string().min(1).max(64),
  x: z.number().finite().min(0).max(2200),
  y: z.number().finite().min(0).max(1600),
  value: z.number().finite().min(-100000).max(100000).optional(),
  property: z.enum(TARGET_PROPERTIES).optional(),
}).strict();
const edgeSchema = z.object({
  id: z.string().min(1).max(64),
  source: z.string().min(1).max(64),
  target: z.string().min(1).max(64),
  port: z.enum(["a", "b", "in"]),
}).strict();
export const graphSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  nodes: z.array(nodeSchema).min(1).max(GRAPH_NODE_LIMIT),
  edges: z.array(edgeSchema).max(GRAPH_EDGE_LIMIT),
}).strict().superRefine((graph, context) => {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  if (nodes.size !== graph.nodes.length)
    context.addIssue({ code: "custom", message: "Duplicate node ID" });
  const edges = new Set<string>();
  const edgeIds = new Set<string>();
  const targets = new Set<string>();
  for (const node of graph.nodes) {
    if ((node.kind === "constant") !== (node.value !== undefined))
      context.addIssue({ code: "custom", message: "Only constants require a value" });
    if ((node.kind === "output") !== (node.property !== undefined))
      context.addIssue({ code: "custom", message: "Only outputs require a target property" });
    if (node.kind === "output" && node.property) {
      if (targets.has(node.property))
        context.addIssue({ code: "custom", message: "Only one output per target property" });
      targets.add(node.property);
    }
  }
  for (const edge of graph.edges) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target || edge.source === edge.target || source.kind === "output")
      context.addIssue({ code: "custom", message: "Invalid connection endpoint" });
    if (target && !inputPorts(target.kind).includes(edge.port))
      context.addIssue({ code: "custom", message: "Invalid target input port" });
    const slot = edge.target + ":" + edge.port;
    if (edges.has(slot) || edgeIds.has(edge.id))
      context.addIssue({ code: "custom", message: "Duplicate input or edge ID" });
    edges.add(slot);
    edgeIds.add(edge.id);
  }
  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }
  const state = new Map<string, number>();
  const walk = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const next of outgoing.get(id) ?? []) if (walk(next)) return true;
    state.set(id, 2);
    return false;
  };
  for (const node of graph.nodes) {
    if (walk(node.id)) {
      context.addIssue({ code: "custom", message: "Graph cycles are not allowed" });
      break;
    }
  }
});
export type NodeGraph = z.infer<typeof graphSchema>;
export type GraphNode = NodeGraph["nodes"][number];
export type GraphEdge = NodeGraph["edges"][number];
export type GraphResult = Readonly<{
  values: Readonly<Record<string, number>>;
  outputs: Readonly<Partial<Record<AnimatableProperty, number>>>;
  error: string | null;
}>;

export function inputPorts(kind: GraphKind): readonly GraphPort[] {
  return kind === "add" || kind === "multiply" ? ["a", "b"]
    : kind === "sine" || kind === "output" ? ["in"] : [];
}
export function parseGraph(value: unknown): NodeGraph | null {
  const result = graphSchema.safeParse(value);
  return result.success ? result.data : null;
}
export function initialGraph(): NodeGraph {
  return {
    schemaVersion: 1, id: "graph-1", title: "Sine motion",
    nodes: [
      { id: "time", kind: "time", title: "Timeline Time", x: 90, y: 340 },
      { id: "amp", kind: "constant", title: "Amplitude", x: 90, y: 95, value: 1 },
      { id: "sine", kind: "sine", title: "Sine", x: 370, y: 340 },
      { id: "product", kind: "multiply", title: "Multiply", x: 630, y: 185 },
      { id: "target", kind: "output", title: "Position X", x: 920, y: 185, property: "offset.x" },
    ],
    edges: [
      { id: "edge-1", source: "time", target: "sine", port: "in" },
      { id: "edge-2", source: "amp", target: "product", port: "a" },
      { id: "edge-3", source: "sine", target: "product", port: "b" },
      { id: "edge-4", source: "product", target: "target", port: "in" },
    ],
  };
}
export function createGraphNode(kind: GraphKind, id: string, x: number, y: number): GraphNode {
  return {
    id, kind, title: ({ constant: "Number", time: "Timeline Time", add: "Add",
      multiply: "Multiply", sine: "Sine", output: "Output" } as const)[kind],
    x: Math.max(0, Math.min(2200, Math.round(x))),
    y: Math.max(0, Math.min(1600, Math.round(y))),
    ...(kind === "constant" ? { value: 1 } : {}),
    ...(kind === "output" ? { property: "opacity" as const } : {}),
  };
}
export function addGraphNode(graph: NodeGraph, node: GraphNode): NodeGraph {
  if (graph.nodes.length >= GRAPH_NODE_LIMIT || graph.nodes.some(old => old.id === node.id)) return graph;
  return parseGraph({ ...graph, nodes: [...graph.nodes, node] }) ?? graph;
}
export function removeGraphNode(graph: NodeGraph, id: string): NodeGraph {
  if (!graph.nodes.some(node => node.id === id) || graph.nodes.length < 2) return graph;
  return parseGraph({
    ...graph, nodes: graph.nodes.filter(node => node.id !== id),
    edges: graph.edges.filter(edge => edge.source !== id && edge.target !== id),
  }) ?? graph;
}
export function updateGraphNode(graph: NodeGraph, id: string, patch: Partial<Pick<GraphNode, "title" | "x" | "y" | "value" | "property">>): NodeGraph {
  if (!graph.nodes.some(node => node.id === id)) return graph;
  const nodes = graph.nodes.map(node => node.id === id ? { ...node, ...patch } : node);
  return parseGraph({ ...graph, nodes }) ?? graph;
}
/** Replace one target input transactionally; reject cycles, invalid ports and duplicate outputs. */
export function connectGraph(graph: NodeGraph, source: string, target: string, port: GraphPort, id: string): NodeGraph {
  const edge = { id, source, target, port };
  if (graph.edges.some(old => old.source === source && old.target === target && old.port === port)) return graph;
  const edges = graph.edges.filter(old => old.target !== target || old.port !== port);
  if (edges.length >= GRAPH_EDGE_LIMIT) return graph;
  return parseGraph({ ...graph, edges: [...edges, edge] }) ?? graph;
}
export function disconnectGraph(graph: NodeGraph, id: string): NodeGraph {
  if (!graph.edges.some(edge => edge.id === id)) return graph;
  return parseGraph({ ...graph, edges: graph.edges.filter(edge => edge.id !== id) }) ?? graph;
}

/** Bounded, pure evaluation; expressions are never eval'ed or executed as code. */
export function evaluateGraph(graph: NodeGraph, time: number): GraphResult {
  if (!Number.isFinite(time) || !parseGraph(graph)) return { values: {}, outputs: {}, error: "Invalid graph or time." };
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const values: Record<string, number> = {};
  const visiting = new Set<string>();
  const compute = (id: string): number => {
    if (Object.hasOwn(values, id)) return values[id];
    if (visiting.has(id)) throw Error("Cycle detected.");
    const node = nodes.get(id);
    if (!node) throw Error("Missing node.");
    visiting.add(id);
    const input = (port: GraphPort): number => {
      const edge = graph.edges.find(edge => edge.target === id && edge.port === port);
      if (!edge) throw Error(node.title + ": connect the " + port + " input.");
      return compute(edge.source);
    };
    let value: number;
    switch (node.kind) {
      case "constant": value = node.value ?? 0; break;
      case "time": value = time; break;
      case "add": value = input("a") + input("b"); break;
      case "multiply": value = input("a") * input("b"); break;
      case "sine": value = Math.sin(input("in")); break;
      case "output": value = input("in"); break;
    }
    if (!Number.isFinite(value) || Math.abs(value) > 1000000) throw Error(node.title + ": result is outside safe numeric bounds.");
    visiting.delete(id);
    values[id] = value;
    return value;
  };
  try {
    const outputs: Partial<Record<AnimatableProperty, number>> = {};
    for (const node of graph.nodes.filter(node => node.kind === "output")) {
      outputs[node.property!] = compute(node.id);
    }
    // Disconnected nodes may remain on the canvas; only output paths are evaluated.
    return { values, outputs, error: null };
  } catch (error) {
    return { values: {}, outputs: {}, error: error instanceof Error ? error.message : "Evaluation failed." };
  }
}
function writeProperty(layer: MathLayer, property: AnimatableProperty, value: number): MathLayer {
  switch (property) {
    case "opacity": return { ...layer, opacity: value };
    case "offset.x": return { ...layer, offset: { ...layer.offset, x: value } };
    case "offset.y": return { ...layer, offset: { ...layer.offset, y: value } };
    case "params.strokeWidth": return { ...layer, params: { ...layer.params, strokeWidth: value } };
    case "formula.a": return layer.kind === "formula" ? { ...layer, formula: { ...layer.formula, a: value } } : layer;
    case "formula.b": return layer.kind === "formula" ? { ...layer, formula: { ...layer.formula, b: value } } : layer;
    case "formula.c": return layer.kind === "formula" ? { ...layer, formula: { ...layer.formula, c: value } } : layer;
  }
}
/** Pure preview projection. Never mutate the authoritative MathDocument. */
export function projectGraph(doc: MathDocument, graph: NodeGraph, layerId: string, time: number):
  { document: MathDocument; error: string | null; result: GraphResult } {
  const result = evaluateGraph(graph, time);
  if (result.error) return { document: doc, error: result.error, result };
  const layer = doc.layers.find(layer => layer.id === layerId);
  if (!layer) return { document: doc, error: "Select a valid scene layer.", result };
  let updated = layer;
  for (const [property, value] of Object.entries(result.outputs) as [AnimatableProperty, number][]) {
    if (!supportsProperty(layer, property))
      return { document: doc, error: property + " requires a Formula layer.", result };
    const bounds = propertyBounds(property);
    if (value < bounds.min || value > bounds.max)
      return { document: doc, error: property + " is outside " + bounds.min + "…" + bounds.max + ".", result };
    if (layer.keyframes?.some(frame => frame.property === property))
      return { document: doc, error: property + " has keyframes. Remove or disable that animation before applying a static graph value.", result };
    updated = writeProperty(updated, property, value);
  }
  const next = updated === layer ? doc : { ...doc, layers: doc.layers.map(item => item.id === layerId ? updated : item) };
  return { document: next, error: null, result };
}
