import { documentFromScene, parseDocument, type MathDocument } from "@/core/document/schema";
import { initialGraph, parseGraph, GRAPH_KEY, type NodeGraph } from "@/core/graph/model";
import { presetFor } from "@/core/scenes/presets";

export const PROJECT_LIBRARY_KEY="paramyra.studio.projects.v1";
export const STUDIO_SCENE_KEY="paramyra.document.v3";
export const MAX_STUDIO_PROJECTS=20;
const MAX_JSON_BYTES=1_000_000;
export type StudioProject = Readonly<{
  id:string; name:string; scene:MathDocument; graph:NodeGraph; updatedAt:number;
}>;
export type StudioLibrary=Readonly<{
  version:1; activeId:string; projects:readonly StudioProject[];
}>;
export type ProjectStore=Pick<Storage,"getItem"|"setItem"|"removeItem">;

function validId(id:unknown):id is string {
  return typeof id==="string"&&id.length>0&&id.length<=64;
}
function parseProject(value:unknown):StudioProject|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!=="graph,id,name,scene,updatedAt" ||
    !validId(v.id)||typeof v.name!=="string"||!v.name.trim()||v.name.length>120||
    typeof v.updatedAt!=="number"||!Number.isFinite(v.updatedAt)||v.updatedAt<0)return null;
  const scene=parseDocument(v.scene),graph=parseGraph(v.graph);
  if(!scene||!graph)return null;
  return {id:v.id,name:v.name,scene,graph,updatedAt:v.updatedAt};
}
export function parseStudioLibrary(value:unknown):StudioLibrary|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!=="activeId,projects,version"||v.version!==1||
    !validId(v.activeId)||!Array.isArray(v.projects)||v.projects.length<1||v.projects.length>MAX_STUDIO_PROJECTS)return null;
  const projects=v.projects.map(parseProject);
  if(projects.some(p=>!p))return null;
  const entries=projects as StudioProject[];
  if(new Set(entries.map(p=>p.id)).size!==entries.length||!entries.some(p=>p.id===v.activeId))return null;
  return {version:1,activeId:v.activeId,projects:entries};
}
function fallback(store:ProjectStore):StudioLibrary{
  let scene:MathDocument|null=null,graph:NodeGraph|null=null;
  try{
    const existing=store.getItem(STUDIO_SCENE_KEY);
    if(existing&&existing.length<MAX_JSON_BYTES)scene=parseDocument(JSON.parse(existing));
  }catch{/* Corrupt legacy scene is ignored. */}
  try{
    const existing=store.getItem(GRAPH_KEY);
    if(existing&&existing.length<MAX_JSON_BYTES)graph=parseGraph(JSON.parse(existing));
  }catch{/* Corrupt legacy graph is ignored. */}
  scene??=documentFromScene(presetFor("lissajous"));
  graph??=initialGraph();
  const id=scene.id||"studio-default";
  return {version:1,activeId:id,projects:[{id,name:scene.title,scene,graph,updatedAt:0}]};
}
export function readStudioLibrary(store:ProjectStore):StudioLibrary{
  try{
    const raw=store.getItem(PROJECT_LIBRARY_KEY);
    if(raw){
      if(raw.length>MAX_JSON_BYTES)return fallback(store);
      const parsed=parseStudioLibrary(JSON.parse(raw));
      if(parsed)return parsed;
    }
  }catch{/* Safe legacy fallback. */}
  return fallback(store);
}
export function activeProject(library:StudioLibrary):StudioProject{
  return library.projects.find(p=>p.id===library.activeId)??library.projects[0];
}
export function replaceActiveScene(library:StudioLibrary,scene:MathDocument,updatedAt:number):StudioLibrary|null{
  const valid=parseDocument(scene);
  if(!valid)return null;
  return {...library,projects:library.projects.map(p=>p.id===library.activeId?{...p,scene:valid,updatedAt}:p)};
}
export function replaceActiveGraph(library:StudioLibrary,graph:NodeGraph,updatedAt:number):StudioLibrary|null{
  const valid=parseGraph(graph);
  if(!valid)return null;
  return {...library,projects:library.projects.map(p=>p.id===library.activeId?{...p,graph:valid,updatedAt}:p)};
}
export function createProject(library:StudioLibrary,id:string,scene:MathDocument,graph:NodeGraph,now:number):StudioLibrary|null{
  if(!validId(id)||library.projects.length>=MAX_STUDIO_PROJECTS||library.projects.some(p=>p.id===id))return null;
  const parsed=parseDocument(scene),validated=parseGraph(graph);
  if(!parsed||!validated)return null;
  return {version:1,activeId:id,projects:[...library.projects,{id,name:parsed.title,scene:parsed,graph:validated,updatedAt:now}]};
}
export function renameProject(library:StudioLibrary,id:string,name:string,now:number):StudioLibrary|null{
  const trimmed=name.trim();
  if(!trimmed||trimmed.length>120||!library.projects.some(p=>p.id===id))return null;
  return {...library,projects:library.projects.map(p=>p.id===id?{...p,name:trimmed,scene:{...p.scene,title:trimmed},updatedAt:now}:p)};
}
export function duplicateProject(library:StudioLibrary,id:string,newId:string,now:number):StudioLibrary|null{
  const source=library.projects.find(p=>p.id===id);
  if(!source||!validId(newId)||library.projects.length>=MAX_STUDIO_PROJECTS||library.projects.some(p=>p.id===newId))return null;
  const scene={...source.scene,id:newId,title:(source.name+" Copy").slice(0,120)};
  return createProject(library,newId,scene,source.graph,now);
}
export function selectProject(library:StudioLibrary,id:string):StudioLibrary|null{
  return library.projects.some(p=>p.id===id)?{...library,activeId:id}:null;
}
export function removeProject(library:StudioLibrary,id:string):StudioLibrary|null{
  if(library.projects.length===1||!library.projects.some(p=>p.id===id))return null;
  const projects=library.projects.filter(p=>p.id!==id);
  return {...library,activeId:library.activeId===id?projects[0].id:library.activeId,projects};
}
/**
 * Best-effort multi-key commit. Registry contains full project snapshots and
 * is authoritative. Legacy scene/graph keys are mirrors for existing workspaces.
 * Restore all keys on a write exception; multi-tab concurrency is last-writer-wins.
 */
export function persistStudioLibrary(library:StudioLibrary,store:ProjectStore):boolean{
  const validated=parseStudioLibrary(library);
  if(!validated)return false;
  const scene=JSON.stringify(activeProject(validated).scene);
  const graph=JSON.stringify(activeProject(validated).graph);
  const serialized=JSON.stringify(validated);
  if(serialized.length>MAX_JSON_BYTES)return false;
  const keys=[STUDIO_SCENE_KEY,GRAPH_KEY,PROJECT_LIBRARY_KEY];
  const values=[scene,graph,serialized];
  let previous:(string|null)[];
  try{previous=keys.map(key=>store.getItem(key));}catch{return false;}
  try{
    for(let i=0;i<keys.length;i++)store.setItem(keys[i],values[i]);
    return true;
  }catch{
    for(let i=keys.length-1;i>=0;i--){
      try{if(previous[i]===null)store.removeItem(keys[i]);else store.setItem(keys[i],previous[i]!);}catch{/* Storage unavailable. */}
    }
    return false;
  }
}
/** Persist one active scene without touching the other saved projects. */
export function writeActiveScene(scene:MathDocument,store:ProjectStore,now:number):StudioLibrary|null{
  const existing=readStudioLibrary(store);
  const next=replaceActiveScene(existing,scene,now);
  return next&&persistStudioLibrary(next,store)?next:null;
}
export function writeActiveGraph(graph:NodeGraph,store:ProjectStore,now:number):StudioLibrary|null{
  const existing=readStudioLibrary(store);
  const next=replaceActiveGraph(existing,graph,now);
  return next&&persistStudioLibrary(next,store)?next:null;
}
