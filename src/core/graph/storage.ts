import { GRAPH_KEY, PREVIOUS_GRAPH_KEY, LEGACY_GRAPH_KEY, initialGraph, parseGraph, type NodeGraph } from "./model";

/** Browser-only input boundary, shared by Graph Workspace and Studio. */
export function readStoredGraph(): NodeGraph {
  if(typeof window==="undefined")return initialGraph();
  for(const key of [GRAPH_KEY,PREVIOUS_GRAPH_KEY,LEGACY_GRAPH_KEY]){
    try{
      const raw=localStorage.getItem(key);
      if(raw){
        const graph=parseGraph(JSON.parse(raw));
        if(graph)return graph;
        // Fail closed instead of reviving a stale enabled graph from the old key.
        if(key===GRAPH_KEY)return initialGraph();
      }
    }catch{
      if(key===GRAPH_KEY)return initialGraph();
    }
  }
  return initialGraph();
}
/** Only persist a validated graph; never activate a stale or corrupt live binding. */
export function persistGraph(graph:NodeGraph):boolean {
  const valid=parseGraph(graph);
  if(!valid||typeof window==="undefined")return false;
  try{
    localStorage.setItem(GRAPH_KEY,JSON.stringify(valid));
    return true;
  }catch{return false;}
}
