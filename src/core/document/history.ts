import type { MathDocument } from "./schema";

export type DocumentHistory = {
  present: MathDocument;
  past: MathDocument[];
  future: MathDocument[];
};
export const HISTORY_LIMIT = 60;

export function initializeHistory(doc: MathDocument): DocumentHistory {
  return { present: doc, past: [], future: [] };
}

export function commitDocument(history: DocumentHistory, next: MathDocument, coalesce = false): DocumentHistory {
  if (next === history.present) return history;
  return {
    present: next,
    past: coalesce ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT),
    future: [],
  };
}
export function undoDocument(history: DocumentHistory): DocumentHistory {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return { present: previous, past: history.past.slice(0, -1), future: [history.present, ...history.future].slice(0, HISTORY_LIMIT) };
}
export function redoDocument(history: DocumentHistory): DocumentHistory {
  if (!history.future.length) return history;
  return { present: history.future[0], past: [...history.past, history.present].slice(-HISTORY_LIMIT), future: history.future.slice(1) };
}
