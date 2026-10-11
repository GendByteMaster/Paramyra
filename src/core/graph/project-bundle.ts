import { parseDocument, type MathDocument } from "../document/schema";
import { supportsProperty } from "../animation/keyframes";
import { GRAPH_KEY, parseGraph, type NodeGraph } from "./model";
import { defaultCourseworkDraft, parseCourseworkDraft, type CourseworkDraft } from "./coursework";

export const SCENE_KEY="paramyra.document.v3";
export const PROJECT_FORMAT="paramyra-project";
export type ProjectBundle=Readonly<{
  format:typeof PROJECT_FORMAT;
  version:2;
  scene:MathDocument;
  graph:NodeGraph;
  coursework:CourseworkDraft;
}>;
export function makeProjectBundle(scene:MathDocument,graph:NodeGraph,coursework:CourseworkDraft=defaultCourseworkDraft(graph)):ProjectBundle|null {
  return parseProjectBundle({format:PROJECT_FORMAT,version:2,scene,graph,coursework});
}
/** Both documents are validated before import; no executable script or external asset refs. */
export function parseProjectBundle(input:unknown):ProjectBundle|null {
  if(typeof input!=="object"||input===null||Array.isArray(input))return null;
  const record=input as Record<string,unknown>;
  const legacy=record.version===1;
  if(Object.keys(record).sort().join(",")!==(legacy?"format,graph,scene,version":"coursework,format,graph,scene,version")||
    record.format!==PROJECT_FORMAT||(!legacy&&record.version!==2))return null;
  const scene=parseDocument(record.scene);
  const graph=parseGraph(record.graph);
  if(!scene||!graph)return null;
  const coursework=legacy?defaultCourseworkDraft(graph):parseCourseworkDraft(record.coursework);
  if(!coursework)return null;
  if(graph.binding.enabled){
    const target=scene.layers.find(layer=>layer.id===graph.binding.layerId);
    if(!target)return null;
    if(graph.nodes.some(node=>node.kind==="output"&&!supportsProperty(target,node.property!)))return null;
  }
  return {format:PROJECT_FORMAT,version:2,scene,graph,coursework};
}
/**
 * localStorage is not transactional across keys/tabs. Roll back on a synchronous
 * write failure so this tab does not retain half an imported project.
 * Existing tabs are notified by storage events; concurrent writes still require
 * a future revision/CAS protocol. Never claim ACID guarantees here.
 */
export function restoreProjectBundle(bundle:ProjectBundle,store:Pick<Storage,"getItem"|"setItem"|"removeItem">):boolean {
  const validated=parseProjectBundle(bundle);
  if(!validated)return false;
  let previousScene:string|null,previousGraph:string|null;
  try{
    previousScene=store.getItem(SCENE_KEY);
    previousGraph=store.getItem(GRAPH_KEY);
  }catch{return false;}
  try{
    store.setItem(GRAPH_KEY,JSON.stringify(validated.graph));
    store.setItem(SCENE_KEY,JSON.stringify(validated.scene));
    return true;
  }catch{
    try{
      if(previousScene===null)store.removeItem(SCENE_KEY);
      else store.setItem(SCENE_KEY,previousScene);
      if(previousGraph===null)store.removeItem(GRAPH_KEY);
      else store.setItem(GRAPH_KEY,previousGraph);
    }catch{/* best effort rollback: storage may be unavailable entirely */}
    return false;
  }
}
