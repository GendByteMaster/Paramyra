import { documentFromScene, parseDocument, type MathDocument } from "../document/schema";
import { initialGraph, parseGraph, GRAPH_KEY, type NodeGraph } from "../graph/model";
import { presetFor } from "../scenes/presets";
import {defaultCourseworkDraft,parseCourseworkDraft,readLegacyCourseworkDraft,type CourseworkDraft} from "../graph/coursework";

export const PROJECT_LIBRARY_KEY="paramyra.studio.projects.v1";
export const STUDIO_SCENE_KEY="paramyra.document.v3";
export const MAX_STUDIO_PROJECTS=20;
const MAX_JSON_BYTES=1_000_000;
export type StudioProject = Readonly<{
  id:string; name:string; scene:MathDocument; graph:NodeGraph; coursework:CourseworkDraft; updatedAt:number;
}>;
export type StudioLibrary=Readonly<{
  version:2; activeId:string; projects:readonly StudioProject[];
}>;
export type ProjectStore=Pick<Storage,"getItem"|"setItem"|"removeItem">;

function validId(id:unknown):id is string {
  return typeof id==="string"&&id.length>0&&id.length<=64;
}
function parseProject(value:unknown,legacy=false):StudioProject|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!==(legacy?"graph,id,name,scene,updatedAt":"coursework,graph,id,name,scene,updatedAt") ||
    !validId(v.id)||typeof v.name!=="string"||!v.name.trim()||v.name.length>120||
    typeof v.updatedAt!=="number"||!Number.isFinite(v.updatedAt)||v.updatedAt<0)return null;
  const scene=parseDocument(v.scene),graph=parseGraph(v.graph);
  if(!scene||!graph)return null;
  const coursework=legacy?defaultCourseworkDraft(graph):parseCourseworkDraft(v.coursework);
  if(!coursework)return null;
  return {id:v.id,name:v.name,scene,graph,coursework,updatedAt:v.updatedAt};
}
export function parseStudioLibrary(value:unknown):StudioLibrary|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!=="activeId,projects,version"||(v.version!==1&&v.version!==2)||
    !validId(v.activeId)||!Array.isArray(v.projects)||v.projects.length<1||v.projects.length>MAX_STUDIO_PROJECTS)return null;
  const projects=v.projects.map(p=>parseProject(p,v.version===1));
  if(projects.some(p=>!p))return null;
  const entries=projects as StudioProject[];
  if(new Set(entries.map(p=>p.id)).size!==entries.length||!entries.some(p=>p.id===v.activeId))return null;
  return {version:2,activeId:v.activeId,projects:entries};
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
  const coursework=readLegacyCourseworkDraft(graph,id,store,true);
  return {version:2,activeId:id,projects:[{id,name:scene.title,scene,graph,coursework,updatedAt:0}]};
}
export function readStudioLibrary(store:ProjectStore):StudioLibrary{
  try{
    const raw=store.getItem(PROJECT_LIBRARY_KEY);
    if(raw){
      if(raw.length>MAX_JSON_BYTES)return fallback(store);
      const input=JSON.parse(raw);
      const parsed=parseStudioLibrary(input);
      if(parsed){
        // v1 contained only the scene and graph; migrate scoped reports into v2.
        // Only the historical first project may inherit an unscoped draft.
        const migrated=input.version===1?{...parsed,projects:parsed.projects.map((p,i)=>({
          ...p,coursework:readLegacyCourseworkDraft(p.graph,p.id,store,i===0),
        }))}:parsed;
        // Existing Studio/Timeline integrations still update the compatibility mirrors.
        // A valid mirror that differs from the active snapshot is an external edit.
        const active=activeProject(migrated);
        let scene=active.scene,graph=active.graph;
        try{
          const mirror=store.getItem(STUDIO_SCENE_KEY);
          const valid=mirror&&mirror.length<MAX_JSON_BYTES?parseDocument(JSON.parse(mirror)):null;
          if(valid&&valid.id===scene.id)scene=valid;
        }catch{/* Ignore malformed external document. */}
        try{
          const mirror=store.getItem(GRAPH_KEY);
          const valid=mirror&&mirror.length<MAX_JSON_BYTES?parseGraph(JSON.parse(mirror)):null;
          if(valid&&valid.id===graph.id)graph=valid;
        }catch{/* Ignore malformed external graph. */}
        if(JSON.stringify(scene)===JSON.stringify(active.scene)&&
           JSON.stringify(graph)===JSON.stringify(active.graph))return migrated;
        return {...migrated,projects:migrated.projects.map(p=>p.id===migrated.activeId?{...p,scene,graph}:p)};
      }
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
export function replaceActiveCoursework(library:StudioLibrary,draft:CourseworkDraft,updatedAt:number):StudioLibrary|null{
  const coursework=parseCourseworkDraft(draft);
  if(!coursework)return null;
  return {...library,projects:library.projects.map(p=>p.id===library.activeId?{...p,coursework,updatedAt}:p)};
}
export function createProject(library:StudioLibrary,id:string,scene:MathDocument,graph:NodeGraph,now:number,report?:CourseworkDraft):StudioLibrary|null{
  if(!validId(id)||library.projects.length>=MAX_STUDIO_PROJECTS||library.projects.some(p=>p.id===id))return null;
  const parsed=parseDocument(scene),validated=parseGraph(graph);
  if(!parsed||!validated)return null;
  const coursework=report?parseCourseworkDraft(report):defaultCourseworkDraft(validated);
  if(!coursework)return null;
  return {version:2,activeId:id,projects:[...library.projects,{id,name:parsed.title,scene:parsed,graph:validated,coursework,updatedAt:now}]};
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
  return createProject(library,newId,scene,source.graph,now,source.coursework);
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
export function persistStudioLibrary(library:StudioLibrary,store:ProjectStore,
  mirrors:{scene?:boolean;graph?:boolean}={scene:true,graph:true}):boolean{
  const validated=parseStudioLibrary(library);
  if(!validated)return false;
  const scene=JSON.stringify(activeProject(validated).scene);
  const graph=JSON.stringify(activeProject(validated).graph);
  const serialized=JSON.stringify(validated);
  if(serialized.length>MAX_JSON_BYTES)return false;
  const keys=[...(mirrors.scene!==false?[STUDIO_SCENE_KEY]:[]),...(mirrors.graph!==false?[GRAPH_KEY]:[]),PROJECT_LIBRARY_KEY];
  const values=[...(mirrors.scene!==false?[scene]:[]),...(mirrors.graph!==false?[graph]:[]),serialized];
  let previous:(string|null)[];
  try{previous=keys.map(key=>store.getItem(key));}catch{return false;}
  // Never destroy a corrupt/unsupported registry when the fallback UI mounts.
  // Recovery needs explicit user action; legacy valid v1 registries remain migratable.
  const previousRegistry=previous[previous.length-1];
  if(previousRegistry!==null){
    try{
      if(previousRegistry.length>MAX_JSON_BYTES||!parseStudioLibrary(JSON.parse(previousRegistry)))return false;
    }catch{return false;}
  }
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
  return next&&persistStudioLibrary(next,store,{graph:false})?next:null;
}
export function writeActiveGraph(graph:NodeGraph,store:ProjectStore,now:number):StudioLibrary|null{
  const existing=readStudioLibrary(store);
  const next=replaceActiveGraph(existing,graph,now);
  return next&&persistStudioLibrary(next,store,{scene:false})?next:null;
}

/** Atomic project snapshot update at the registry level; mirrors are not changed. */
export function writeActiveCoursework(draft:CourseworkDraft,store:ProjectStore,now:number):StudioLibrary|null{
  const current=readStudioLibrary(store);
  const next=replaceActiveCoursework(current,draft,now);
  return next&&persistStudioLibrary(next,store,{scene:false,graph:false})?next:null;
}
