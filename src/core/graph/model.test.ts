import { describe, expect, it } from "vitest";
import { documentFromScene, newFormulaLayer } from "../document/schema";
import { presets } from "../scenes/presets";
import { addGraphNode, connectGraph, createGraphNode, disconnectGraph, evaluateGraph,
  initialGraph, parseGraph, projectGraph, removeGraphNode, updateGraphNode } from "./model";
import { commitGraph, initializeGraphHistory, redoGraph, undoGraph } from "./history";

describe("M3 deterministic Node Graph domain", () => {
  it("ships a valid functional default graph and evaluates sine motion", () => {
    const graph = initialGraph();
    expect(parseGraph(graph)).toEqual(graph);
    expect(evaluateGraph(graph, 0).outputs["offset.x"]).toBeCloseTo(0);
    expect(evaluateGraph(graph, Math.PI / 2).outputs["offset.x"]).toBeCloseTo(1);
    expect(evaluateGraph(graph, 0).error).toBeNull();
  });
  it("enforces strict typed ports, acyclicity, and unique numeric destinations", () => {
    const graph = initialGraph();
    expect(connectGraph(graph, "product", "sine", "in", "cycle")).toBe(graph);
    expect(connectGraph(graph, "product", "time", "in", "bad-port")).toBe(graph);
    expect(connectGraph(graph, "target", "product", "b", "out-of-output")).toBe(graph);
    expect(connectGraph(graph, "missing", "sine", "in", "missing")).toBe(graph);
    expect(parseGraph({...graph, nodes:[...graph.nodes, graph.nodes[0]]})).toBeNull();
    expect(parseGraph({...graph, edges:[...graph.edges, graph.edges[0]]})).toBeNull();
    expect(parseGraph({...graph, title:"<script>alert(1)</script>", extra: "data"})).toBeNull();
    expect(parseGraph({...graph, edges:[{id:"self",source:"time",target:"time",port:"in"}]})).toBeNull();
    const output = createGraphNode("output", "second", 150, 100);
    const withOutput = addGraphNode(graph, output);
    expect(withOutput.nodes.length).toBe(graph.nodes.length+1);
    expect(addGraphNode(withOutput, createGraphNode("output", "third", 400, 100))).toBe(withOutput);
  });
  it("atomically rewires a port while preserving unrelated edges", () => {
    const graph = initialGraph();
    const next = connectGraph(graph, "time", "product", "a", "new-edge");
    expect(next).not.toBe(graph);
    expect(next.edges.find(edge => edge.target==="product" && edge.port==="a")?.source).toBe("time");
    expect(next.edges.filter(edge => edge.target==="product" && edge.port==="a")).toHaveLength(1);
    expect(disconnectGraph(next,"new-edge").edges).toHaveLength(graph.edges.length-1);
    expect(disconnectGraph(next,"not-found")).toBe(next);
  });
  it("fails closed on disconnected outputs and numeric overflow", () => {
    const graph = initialGraph();
    const removed = disconnectGraph(graph, "edge-4");
    expect(evaluateGraph(removed,1).error).toMatch(/connect.*in/);
    expect(evaluateGraph(graph,NaN).error).toMatch(/invalid/i);
    const large = updateGraphNode(graph, "amp", {value:100000});
    const result = evaluateGraph(large,1);
    expect(result.error).toBeNull();
    expect(result.outputs["offset.x"]).toBeGreaterThan(2);
  });
  it("projects outputs only onto selected layer and preserves MathDocument immutability", () => {
    const doc = documentFromScene(presets[0]);
    const graph = initialGraph();
    const before = JSON.stringify(doc);
    const projection = projectGraph(doc,graph,doc.layers[0].id,Math.PI/2);
    expect(projection.error).toBeNull();
    expect(projection.document.layers[0].offset.x).toBeCloseTo(1);
    expect(JSON.stringify(doc)).toBe(before);
    const over = updateGraphNode(graph,"amp",{value:4});
    expect(projectGraph(doc,over,doc.layers[0].id,Math.PI/2).error).toMatch(/outside/);
    expect(projectGraph(doc,graph,"missing",1).error).toMatch(/valid scene layer/);
  });
  it("protects animated properties and formula-only targets", () => {
    const doc = documentFromScene(presets[0]);
    const animated = {...doc,layers:[{...doc.layers[0],keyframes:[
      {property:"offset.x" as const,time:0,value:0,ease:"linear" as const},
    ]}]};
    expect(projectGraph(animated,initialGraph(),doc.layers[0].id,1).error).toMatch(/keyframes/);
    const formula = newFormulaLayer("formula-1");
    const formulaDoc = {...doc,layers:[formula]};
    const graph = initialGraph();
    const output = updateGraphNode(graph,"target",{property:"formula.a"});
    expect(projectGraph(doc,output,doc.layers[0].id,1).error).toMatch(/Formula layer/);
    expect(projectGraph(formulaDoc,output,"formula-1",1).error).toBeNull();
    expect(projectGraph(formulaDoc,output,"formula-1",1).document.layers[0].kind).toBe("formula");
  });
  it("supports immutable deletion and bounded undo redo", () => {
    const graph = initialGraph();
    expect(removeGraphNode(graph,"target").edges).toHaveLength(3);
    const reduced = removeGraphNode(graph,"sine");
    expect(reduced.nodes).toHaveLength(4);
    expect(reduced.edges).toHaveLength(2);
    const newNode = createGraphNode("add","new-add",100,150);
    const next = addGraphNode(graph,newNode);
    let history = commitGraph(initializeGraphHistory(graph),next);
    expect(history.present).toBe(next);
    history = undoGraph(history);
    expect(history.present).toBe(graph);
    expect(redoGraph(history).present).toBe(next);
    expect(commitGraph(history,history.present)).toBe(history);
  });
});
