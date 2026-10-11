import { describe, expect, it } from "vitest";
import { courseworkFormulas, defaultCourseworkDraft } from "./coursework";
import { initialGraph, updateGraphNode } from "./model";

describe("Coursework formulas and report drafts", () => {
  it("derives the real connected mathematical expression without evaluating arbitrary code", () => {
    expect(courseworkFormulas(initialGraph())).toEqual([
      { property: "offset.x", expression: "(1 × sin(t))" },
    ]);
  });
  it("tracks changes to the authoritative graph without rewriting it", () => {
    const base = initialGraph();
    const changed = updateGraphNode(base, "amp", {value: 1.75});
    expect(courseworkFormulas(changed)).toEqual([
      {property:"offset.x",expression:"(1.75 × sin(t))"},
    ]);
    expect(base.nodes.find(n=>n.id==="amp")?.value).toBe(1);
  });
  it("starts a report with editable content scoped to graph identity", () => {
    const graph = initialGraph();
    const draft = defaultCourseworkDraft(graph);
    expect(draft.version).toBe(1);
    expect(draft.title).toContain(graph.title);
    expect(draft.objective).toBe("");
    expect(draft.institution).toBe("");
  });
});
