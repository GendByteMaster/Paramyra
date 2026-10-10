import { z } from "zod";
import {
  GRAPH_EDGE_LIMIT, GRAPH_NODE_LIMIT, TARGET_PROPERTIES, parseGraph,
  type GraphEdge, type GraphNode, type NodeGraph,
} from "./model";

const fragmentSchema=z.object({
  format:z.literal("paramyra-graph-selection"),
  version:z.literal(1),
  nodes:z.array(z.object({
    id:z.string().min(1).max(64), kind:z.enum(["constant","time","add","multiply","sine","output"]),
    title:z.string().min(1).max(64),x:z.number().finite(),y:z.number().finite(),
    value:z.number().finite().optional(),
    property:z.enum(TARGET_PROPERTIES).optional(),
  }).strict()).min(1).max(GRAPH_NODE_LIMIT),
  edges:z.array(z.object({
    id:z.string().min(1).max(64),source:z.string(),target:z.string(),port:z.enum(["a","b","in"]),
  }).strict()).max(GRAPH_EDGE_LIMIT),
  groups:z.array(z.object({
    id:z.string().min(1).max(64), title:z.string().min(1).max(64),
    nodeIds:z.array(z.string().min(1).max(64)).min(2).max(GRAPH_NODE_LIMIT),
  }).strict()).max(16),
}).strict();
export type GraphSelection=z.infer<typeof fragmentSchema>;
export function copyGraphSelection(graph:NodeGraph, ids:readonly string[]):GraphSelection|null {
  const selected=new Set(ids);
  const nodes=graph.nodes.filter(n=>selected.has(n.id));
  if(!nodes.length)return null;
  return {format:"paramyra-graph-selection",version:1,nodes,
    edges:graph.edges.filter(e=>selected.has(e.source)&&selected.has(e.target)),
    groups:graph.groups.filter(g=>g.nodeIds.every(id=>selected.has(id)))};
}
export function parseGraphSelection(value:unknown):GraphSelection|null {
  const r=fragmentSchema.safeParse(value);
  if(!r.success)return null;
  const nodes=new Set(r.data.nodes.map(n=>n.id));
  if(nodes.size!==r.data.nodes.length)return null;
  if(r.data.edges.some(e=>!nodes.has(e.source)||!nodes.has(e.target)))return null;
  if(r.data.groups.some(g=>g.nodeIds.some(id=>!nodes.has(id))))return null;
  return r.data;
}
export type PasteResult={graph:NodeGraph;nodeIds:string[];error:string|null};
export function pasteGraphSelection(graph:NodeGraph,selection:GraphSelection,
  newId:()=>string,offset=56):PasteResult {
  const fragment=parseGraphSelection(selection);
  const fail=(error:string):PasteResult=>({graph,nodeIds:[],error});
  if(!fragment)return fail("Invalid clipboard content.");
  if(graph.nodes.length+fragment.nodes.length>GRAPH_NODE_LIMIT||
      graph.edges.length+fragment.edges.length>GRAPH_EDGE_LIMIT||
      graph.groups.length+fragment.groups.length>16)return fail("Graph capacity exceeded.");
  const ids=new Map<string,string>();
  const occupied=new Set([...graph.nodes.map(n=>n.id),...graph.edges.map(e=>e.id),...graph.groups.map(g=>g.id)]);
  const fresh=()=>{const id=newId();if(!id||id.length>64||occupied.has(id))throw Error("Duplicate generated ID.");occupied.add(id);return id;};
  try{
    const taken=new Set(graph.nodes.filter(n=>n.kind==="output").map(n=>n.property));
    const nodes:GraphNode[]=fragment.nodes.map(node=>{
      const id=fresh();ids.set(node.id,id);
      let property=node.property;
      if(node.kind==="output"){
        if(taken.has(property)){
          property=TARGET_PROPERTIES.find(candidate=>!taken.has(candidate));
          if(!property)throw Error("No unused output target available for pasted node.");
        }
        taken.add(property);
      }
      const x=node.x+offset,y=node.y+offset;
      if(x>2200||y>1600||x<0||y<0)throw Error("Paste exceeds canvas bounds.");
      return {...node,id,x,y,...(node.kind==="output"?{property}:{})};
    });
    const edges:GraphEdge[]=fragment.edges.map(edge=>({
      ...edge,id:fresh(),source:ids.get(edge.source)!,target:ids.get(edge.target)!,
    }));
    const groups=fragment.groups.map(group=>({
      ...group,id:fresh(),nodeIds:group.nodeIds.map(id=>ids.get(id)!),
    }));
    const next=parseGraph({...graph,nodes:[...graph.nodes,...nodes],edges:[...graph.edges,...edges],
      groups:[...graph.groups,...groups]});
    return next?{graph:next,nodeIds:nodes.map(n=>n.id),error:null}:fail("Pasted selection violates DAG or grouping constraints.");
  }catch(e){return fail(e instanceof Error?e.message:"Paste failed.");}
}
export function deleteGraphSelection(graph:NodeGraph,ids:readonly string[]):NodeGraph {
  const selected=new Set(ids);
  const nodes=graph.nodes.filter(n=>!selected.has(n.id));
  if(!nodes.length||nodes.length===graph.nodes.length)return graph;
  return parseGraph({...graph,nodes,
    edges:graph.edges.filter(e=>!selected.has(e.source)&&!selected.has(e.target)),
    groups:graph.groups.map(g=>({...g,nodeIds:g.nodeIds.filter(id=>!selected.has(id))}))
      .filter(g=>g.nodeIds.length>=2),
  })??graph;
}
export function moveGraphSelection(graph:NodeGraph,ids:readonly string[],dx:number,dy:number):NodeGraph {
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return graph;
  const selected=new Set(ids);
  const nodes=graph.nodes.map(node=>selected.has(node.id)?{
    ...node,x:Math.round(node.x+dx),y:Math.round(node.y+dy),
  }:node);
  if(nodes.every((node,i)=>node.x===graph.nodes[i].x&&node.y===graph.nodes[i].y))return graph;
  return parseGraph({...graph,nodes})??graph;
}
export function groupGraphNodes(graph:NodeGraph,ids:readonly string[],id:string,title="Node Group"):NodeGraph {
  const selected=new Set(ids);
  const eligible=graph.nodes.filter(n=>selected.has(n.id)&&!graph.groups.some(g=>g.nodeIds.includes(n.id)));
  if(eligible.length<2||eligible.length!==selected.size||graph.groups.length>=16)return graph;
  return parseGraph({...graph,groups:[...graph.groups,{id,title,nodeIds:eligible.map(n=>n.id)}]})??graph;
}
export function ungroupGraphNodes(graph:NodeGraph,groupId:string):NodeGraph {
  if(!graph.groups.some(g=>g.id===groupId))return graph;
  return parseGraph({...graph,groups:graph.groups.filter(g=>g.id!==groupId)})??graph;
}
