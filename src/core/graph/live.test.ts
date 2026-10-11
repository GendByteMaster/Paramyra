import {describe,it,expect} from "vitest";
import { documentFromScene, newFormulaLayer } from "../document/schema";
import { presets } from "../scenes/presets";
import { resolveAnimatedDocument } from "../animation/keyframes";
import { compileGraph, evaluateCompiledGraph, resolveLiveScene, validateLiveGraphRange } from "./live";
import { addGraphNode, connectGraph, createGraphNode, DISABLED_BINDING,
  initialGraph, parseGraph, updateGraphBinding, updateGraphNode } from "./model";

function live(layerId: string) {
  const graph=updateGraphBinding(initialGraph(),{enabled:true,layerId,priority:"keyframes-win"});
  return compileGraph(graph)!;
}
describe("M3.1 Live Node Graph integration",()=>{
  it("migrates v1 graphs safely to disabled bindings with strict v2 validation",()=>{
    const graph=initialGraph();
    const legacy={schemaVersion:1,id:graph.id,title:graph.title,nodes:graph.nodes,edges:graph.edges};
    expect(parseGraph(legacy)).toEqual({...graph,binding:DISABLED_BINDING});
    expect(parseGraph({...graph,binding:{enabled:true,layerId:null,priority:"keyframes-win"}})).toBeNull();
    expect(parseGraph({...graph,binding:{enabled:true,layerId:"layer-1",priority:"graph-win"}})).toBeNull();
    expect(parseGraph({...legacy,extra:"hidden"})).toBeNull();
    expect(parseGraph({...legacy,edges:[...legacy.edges,{id:"cycle",source:"product",target:"sine",port:"in"}]})).toBeNull();
  });
  it("uses animation clock to evaluate graph outputs without writing any base state",()=>{
    const doc=documentFromScene(presets[0]);
    const compiled=live(doc.layers[0].id);
    const original=JSON.stringify(doc);
    const atZero=resolveLiveScene(doc,0,compiled);
    const atQuarter=resolveLiveScene(doc,Math.PI/2,compiled);
    expect(atZero.document.layers[0].offset.x).toBeCloseTo(0);
    expect(atQuarter.document.layers[0].offset.x).toBeCloseTo(1);
    expect(atQuarter.driven).toEqual(["offset.x"]);
    expect(atQuarter.blocked).toEqual([]);
    expect(JSON.stringify(doc)).toBe(original);
    expect(resolveLiveScene(doc,Math.PI/2,compileGraph(initialGraph())).document).toBe(doc);
    expect(evaluateCompiledGraph(compiled,Math.PI/2).outputs["offset.x"]).toBeCloseTo(1);
  });
  it("keyframes always win on conflicts while graph drives other properties",()=>{
    const doc=documentFromScene(presets[0]);
    doc.layers[0]={...doc.layers[0],keyframes:[
      {property:"offset.x",time:0,value:.3,ease:"linear"},
      {property:"offset.x",time:12,value:.7,ease:"linear"},
    ]};
    const graph=initialGraph();
    const extra=addGraphNode(graph,createGraphNode("constant","alpha",90,95));
    const alpha=updateGraphNode(extra,"alpha",{value:.45});
    const output=addGraphNode(alpha,{...createGraphNode("output","opacity-out",500,200),property:"opacity"});
    const linked=connectGraph(output,"alpha","opacity-out","in","alpha-link");
    const compiled=compileGraph(updateGraphBinding(linked,{enabled:true,layerId:doc.layers[0].id,priority:"keyframes-win"}))!;
    const time=5;
    const result=resolveLiveScene(doc,time,compiled);
    expect(result.error).toBeNull();
    expect(result.blocked).toEqual(["offset.x"]);
    expect(result.driven).toEqual(["opacity"]);
    expect(result.document.layers[0].offset.x).toBeCloseTo(.3+(.7-.3)*(5/12));
    expect(result.document.layers[0].opacity).toBeCloseTo(.45);
    expect(doc.layers[0].opacity).toBe(1);
    expect(result.document.layers[0].keyframes).toEqual(doc.layers[0].keyframes);
  });
  it("fails closed atomically on invalid output or a missing target layer",()=>{
    const doc=documentFromScene(presets[0]);
    const broken=updateGraphNode(initialGraph(),"amp",{value:4});
    const compiled=compileGraph(updateGraphBinding(broken,{enabled:true,layerId:doc.layers[0].id,priority:"keyframes-win"}))!;
    const time=Math.PI/2;
    const result=resolveLiveScene(doc,time,compiled);
    expect(result.error).toMatch(/outside/);
    expect(result.document).toBe(doc);
    const orphan=live("removed-layer");
    expect(resolveLiveScene(doc,1,orphan).error).toMatch(/no longer exists/);
    expect(resolveLiveScene(doc,1,orphan).document).toBe(doc);
    const disconnected=compileGraph(updateGraphBinding(
      {...initialGraph(),edges:initialGraph().edges.filter(edge=>edge.id!=="edge-4")},
      {enabled:true,layerId:doc.layers[0].id,priority:"keyframes-win"}))!;
    expect(resolveLiveScene(doc,1,disconnected).error).toMatch(/connect/);
  });
  it("keeps animated output stable when graph is invalid and supports formula-only channels",()=>{
    const doc=documentFromScene(presets[0]);
    doc.layers[0]={...doc.layers[0],keyframes:[
      {property:"opacity",time:0,value:.2,ease:"linear"},
      {property:"opacity",time:12,value:.8,ease:"linear"},
    ]};
    const invalid=compileGraph(updateGraphBinding(updateGraphNode(initialGraph(),"amp",{value:5}),
      {enabled:true,layerId:doc.layers[0].id,priority:"keyframes-win"}))!;
    const result=resolveLiveScene(doc,Math.PI/2,invalid);
    const animated=resolveAnimatedDocument(doc,Math.PI/2);
    expect(result.error).toMatch(/outside/);
    expect(result.document).toEqual(animated);
    const formulaDoc={...doc,layers:[newFormulaLayer("formula") ]};
    const propertyGraph=updateGraphNode(initialGraph(),"target",{property:"formula.a"});
    const bound=compileGraph(updateGraphBinding(propertyGraph,{enabled:true,layerId:"formula",priority:"keyframes-win"}))!;
    expect(resolveLiveScene(formulaDoc,1,bound).document.layers[0].kind).toBe("formula");
    expect(resolveLiveScene(doc,1,compileGraph(updateGraphBinding(propertyGraph,{enabled:true,layerId:doc.layers[0].id,priority:"keyframes-win"}))).error).toMatch(/Formula layer/);
  });
  it("executes repeated frames using the cached topology with deterministic values",()=>{
    const doc=documentFromScene(presets[0]);
    const compiled=live(doc.layers[0].id);
    const samples=Array.from({length:1000},(_,index)=>resolveLiveScene(doc,index/100,compiled));
    expect(samples.every(sample=>sample.error===null)).toBe(true);
    expect(samples[123].document.layers[0].offset.x).toBeCloseTo(Math.sin(1.23));
  });
});

describe("M3.5 Live Graph full-timeline safety",()=>{
  it("catches amplitude 20 despite a valid output at the initial frame",()=>{
    const doc=documentFromScene(presets[0]);
    const big=updateGraphNode(initialGraph(),"amp",{value:20});
    const enabled=updateGraphBinding(big,{enabled:true,layerId:doc.layers[0].id,priority:"keyframes-win"});
    const compiled=compileGraph(enabled)!;
    expect(evaluateCompiledGraph(compiled,0).error).toBeNull();
    expect(resolveLiveScene(doc,0,compiled).error).toContain("outside -2…2");
    expect(resolveLiveScene(doc,0,compiled).document).toBe(doc);
    expect(validateLiveGraphRange(doc,compiled)).toContain("outside -2…2");
    expect(validateLiveGraphRange(doc,compiled)).toContain("-20.00…20.00");
  });
  it("allows a bounded sine graph and rejects out-of-range properties",()=>{
    const doc=documentFromScene(presets[0]);
    expect(validateLiveGraphRange(doc,live(doc.layers[0].id))).toBeNull();
    const safe=updateGraphNode(initialGraph(),"amp",{value:2});
    expect(validateLiveGraphRange(doc,compileGraph(updateGraphBinding(safe,{
      enabled:true,layerId:doc.layers[0].id,priority:"keyframes-win"
    })))).toBeNull();
    const large=updateGraphNode(initialGraph(),"amp",{value:2.001});
    expect(validateLiveGraphRange(doc,compileGraph(updateGraphBinding(large,{
      enabled:true,layerId:doc.layers[0].id,priority:"keyframes-win"
    })))).toContain("outside -2…2");
  });
  it("skips the graph range check when a keyframe owns the target channel",()=>{
    const doc=documentFromScene(presets[0]);
    doc.layers[0]={...doc.layers[0],keyframes:[{property:"offset.x",time:0,value:0.5,ease:"linear"}]};
    const large=updateGraphNode(initialGraph(),"amp",{value:20});
    const compiled=compileGraph(updateGraphBinding(large,{
      enabled:true,layerId:doc.layers[0].id,priority:"keyframes-win"
    }))!;
    expect(validateLiveGraphRange(doc,compiled)).toBeNull();
    expect(resolveLiveScene(doc,Math.PI/2,compiled).blocked).toEqual(["offset.x"]);
  });
});
