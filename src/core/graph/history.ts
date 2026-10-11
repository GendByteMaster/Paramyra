import type { NodeGraph } from "./model";

/** Graph undo history is distinct from MathDocument history: no competing scene mutations. */
export type GraphHistory = Readonly<{ present: NodeGraph; past: NodeGraph[]; future: NodeGraph[] }>;
export const GRAPH_HISTORY_LIMIT = 60;
export function initializeGraphHistory(graph: NodeGraph): GraphHistory {
  return { present: graph, past: [], future: [] };
}
export function commitGraph(history: GraphHistory, next: NodeGraph): GraphHistory {
  if (next === history.present) return history;
  return { present: next,
    past: [...history.past, history.present].slice(-GRAPH_HISTORY_LIMIT),
    future: [] };
}
export function undoGraph(history: GraphHistory): GraphHistory {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return { present: previous, past: history.past.slice(0, -1),
    future: [history.present, ...history.future].slice(0, GRAPH_HISTORY_LIMIT) };
}
export function redoGraph(history: GraphHistory): GraphHistory {
  if (!history.future.length) return history;
  return { present: history.future[0],
    past: [...history.past, history.present].slice(-GRAPH_HISTORY_LIMIT),
    future: history.future.slice(1) };
}
