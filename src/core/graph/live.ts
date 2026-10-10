import { resolveAnimatedDocument, propertyBounds, supportsProperty, type AnimatableProperty } from "../animation/keyframes";
import type { MathDocument } from "../document/schema";
import { parseGraph, writeGraphProperty, type GraphNode, type GraphResult, type NodeGraph, type GraphPort } from "./model";

/**
 * Compile topology once per graph change, never per animation frame.
 * The validated graph remains authoritative; this map is strictly an execution cache.
 */
export type CompiledGraph = Readonly<{
  graph: NodeGraph;
  nodes: ReadonlyMap<string, GraphNode>;
  sources: ReadonlyMap<string, string>;
  outputs: readonly GraphNode[];
}>;

export function compileGraph(graph: NodeGraph | null): CompiledGraph | null {
  const valid=graph && parseGraph(graph);
  if (!valid) return null;
  return {
    graph: valid,
    nodes: new Map(valid.nodes.map(node=>[node.id,node])),
    sources: new Map(valid.edges.map(edge=>[edge.target+":"+edge.port,edge.source])),
    outputs: valid.nodes.filter(node=>node.kind==="output"),
  };
}
export function evaluateCompiledGraph(compiled: CompiledGraph, time: number): GraphResult {
  if(!Number.isFinite(time))return {values:{},outputs:{},error:"Invalid playhead time."};
  const values:Record<string,number>={};
  const visiting=new Set<string>();
  const compute=(id:string):number=>{
    if(Object.hasOwn(values,id))return values[id];
    if(visiting.has(id))throw Error("Cycle detected.");
    const node=compiled.nodes.get(id);
    if(!node)throw Error("Missing source node.");
    visiting.add(id);
    const input=(port:GraphPort):number=>{
      const source=compiled.sources.get(id+":"+port);
      if(!source)throw Error(node.title+": connect the "+port+" input.");
      return compute(source);
    };
    let value:number;
    switch(node.kind){
      case "constant":value=node.value??0;break;
      case "time":value=time;break;
      case "add":value=input("a")+input("b");break;
      case "multiply":value=input("a")*input("b");break;
      case "sine":value=Math.sin(input("in"));break;
      case "output":value=input("in");break;
    }
    if(!Number.isFinite(value)||Math.abs(value)>1000000)throw Error(node.title+": numeric overflow.");
    visiting.delete(id);
    values[id]=value;
    return value;
  };
  try{
    const outputs:Partial<Record<AnimatableProperty,number>>={};
    for(const node of compiled.outputs)outputs[node.property!]=compute(node.id);
    return {values,outputs,error:null};
  }catch(error){
    return {values:{},outputs:{},error:error instanceof Error?error.message:"Evaluation failed."};
  }
}

export type LiveScene = Readonly<{
  document:MathDocument;
  error:string|null;
  driven:readonly AnimatableProperty[];
  blocked:readonly AnimatableProperty[];
}>;

/**
 * Ordering is explicit and deterministic:
 *   MathDocument base -> keyframe interpolation -> graph output for unkeyed channels.
 * A keyed channel ALWAYS wins, even between its first and last keyframes.
 * Any invalid graph value fails closed atomically to the animated document.
 * No live result is written into MathDocument or localStorage.
 */
export function resolveLiveScene(doc: MathDocument,time:number,compiled:CompiledGraph|null):LiveScene {
  const animated=resolveAnimatedDocument(doc,time);
  if(!compiled?.graph.binding.enabled)return {document:animated,error:null,driven:[],blocked:[]};
  const {layerId}=compiled.graph.binding;
  const layer=animated.layers.find(layer=>layer.id===layerId);
  const source=doc.layers.find(layer=>layer.id===layerId);
  if(!layer||!source)return {document:animated,error:"Live Graph target layer no longer exists.",driven:[],blocked:[]};
  const result=evaluateCompiledGraph(compiled,time);
  if(result.error)return {document:animated,error:result.error,driven:[],blocked:[]};

  let changed=layer;
  const driven:AnimatableProperty[]=[];
  const blocked:AnimatableProperty[]=[];
  for(const [property,value] of Object.entries(result.outputs) as [AnimatableProperty,number][]){
    if(!supportsProperty(source,property))
      return {document:animated,error:property+" requires a Formula layer.",driven:[],blocked:[]};
    // Check keyframes on the original document, never on a cached presentation.
    if(source.keyframes?.some(frame=>frame.property===property)){
      blocked.push(property);
      continue;
    }
    const bounds=propertyBounds(property);
    if(value<bounds.min||value>bounds.max)
      return {document:animated,error:property+" is outside "+bounds.min+"…"+bounds.max+".",driven:[],blocked:[]};
    changed=writeGraphProperty(changed,property,value);
    driven.push(property);
  }
  return {
    document:changed===layer?animated:{...animated,layers:animated.layers.map(l=>l.id===layerId?changed:l)},
    error:null,driven,blocked,
  };
}
