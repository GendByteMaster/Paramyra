import { parseDocument, type MathDocument } from "../document/schema";
import { supportsProperty } from "../animation/keyframes";
import { parseGraph, type NodeGraph } from "./model";
import { defaultCourseworkDraft, parseCourseworkDraft, type CourseworkDraft } from "./coursework";
import {readStudioLibrary,replaceActiveScene,replaceActiveGraph,replaceActiveCoursework,persistStudioLibrary,type ProjectStore} from "../projects/studio-library";

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
 * Restore scene, graph, animation keyframes and Coursework as one active project
 * snapshot, rather than writing a pair of orphan legacy mirrors. The registry
 * commit and mirror rollback are best-effort, not multi-tab ACID transactions.
 */
export function restoreProjectBundle(bundle:ProjectBundle,store:ProjectStore):boolean {
  const validated=parseProjectBundle(bundle);
  if(!validated)return false;
  const current=readStudioLibrary(store);
  const now=Date.now();
  const scene=replaceActiveScene(current,validated.scene,now);
  const graph=scene&&replaceActiveGraph(scene,validated.graph,now);
  const restored=graph&&replaceActiveCoursework(graph,validated.coursework,now);
  return !!restored&&persistStudioLibrary(restored,store);
}
