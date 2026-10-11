import {openDatabase,CHECKPOINT_STORE} from "./durable-checkpoints";
import {
  PROJECT_LIBRARY_KEY,activeProject,parseStudioLibrary,readStudioLibrary,
  replaceActiveScene,replaceActiveGraph,replaceActiveCoursework,
  type ProjectStore,type StudioLibrary,
} from "./studio-library";
import type {MathDocument} from "../document/schema";
import type {NodeGraph} from "../graph/model";
import type {CourseworkDraft} from "../graph/coursework";

/**
 * Authoritative-store candidate, stored alongside opt-in manual checkpoints.
 * This is not connected to the editor autosave until all writer paths can await
 * a single revisioned transaction. Do not silently promote this over live data.
 */
export const LIVE_PROJECT_RECORD_KEY = "studio-library-live";
const MAX_SNAPSHOT_CHARS=1_000_000;

export type LiveLibraryRecord=Readonly<{
  key:typeof LIVE_PROJECT_RECORD_KEY;version:1;revision:number;updatedAt:number;library:StudioLibrary;
}>;
export type LiveRead =
  | {status:"ready";record:LiveLibraryRecord}
  | {status:"empty"|"invalid"|"unavailable"};
export type LiveInitialize =
  | {status:"ready";record:LiveLibraryRecord;created:boolean}
  | {status:"invalid-legacy"|"invalid"|"unavailable"};
export type LiveCommit =
  | {status:"saved";record:LiveLibraryRecord}
  | {status:"conflict"|"missing"|"invalid"|"unavailable"};

export function parseLiveLibraryRecord(value:unknown):LiveLibraryRecord|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const record=value as Record<string,unknown>;
  if(Object.keys(record).sort().join(",")!=="key,library,revision,updatedAt,version" ||
    record.key!==LIVE_PROJECT_RECORD_KEY || record.version!==1 ||
    !Number.isSafeInteger(record.revision) || (record.revision as number)<1 ||
    typeof record.updatedAt!=="number"||!Number.isFinite(record.updatedAt)||record.updatedAt<0)return null;
  // Forbid implicit library v1 migration within a durable record. Migrating
  // historical reports requires the original localStorage context instead.
  const raw=record.library as Record<string,unknown>|null;
  if(!raw||raw.version!==2)return null;
  const library=parseStudioLibrary(raw);
  return library?{key:LIVE_PROJECT_RECORD_KEY,version:1,revision:record.revision as number,
    updatedAt:record.updatedAt,library}:null;
}

function validSnapshot(library:StudioLibrary):StudioLibrary|null{
  const valid=parseStudioLibrary(library);
  if(!valid||JSON.stringify(valid).length>MAX_SNAPSHOT_CHARS)return null;
  return valid;
}

function factoryOrNull():IDBFactory|null{
  return typeof indexedDB==="undefined"?null:indexedDB;
}

/** Pure input validation for legacy migration. Never overwrite corrupt data. */
export function migrationCandidate(store:ProjectStore):StudioLibrary|null{
  try{
    const raw=store.getItem(PROJECT_LIBRARY_KEY);
    if(raw){
      if(raw.length>MAX_SNAPSHOT_CHARS||!parseStudioLibrary(JSON.parse(raw)))return null;
    }
    return validSnapshot(readStudioLibrary(store));
  }catch{return null;}
}

export async function readLiveProjectLibrary(
  factory:IDBFactory|null=factoryOrNull(),
):Promise<LiveRead>{
  if(!factory)return {status:"unavailable"};
  let db:IDBDatabase;
  try{db=await openDatabase(factory);}catch{return {status:"unavailable"};}
  try{
    return await new Promise<LiveRead>(resolve=>{
      let outcome:LiveRead={status:"unavailable"};
      try{
        const tx=db.transaction(CHECKPOINT_STORE,"readonly");
        const request=tx.objectStore(CHECKPOINT_STORE).get(LIVE_PROJECT_RECORD_KEY);
        request.onsuccess=()=>{
          if(request.result===undefined)outcome={status:"empty"};
          else{
            const record=parseLiveLibraryRecord(request.result);
            outcome=record?{status:"ready",record}:{status:"invalid"};
          }
        };
        tx.oncomplete=()=>resolve(outcome);
        tx.onabort=()=>resolve({status:"unavailable"});
        tx.onerror=()=>resolve({status:"unavailable"});
      }catch{resolve({status:"unavailable"});}
    });
  }finally{db.close();}
}

/**
 * First-run import checks and persists within a single IDB transaction.
 * The localStorage snapshot is read before opening the transaction, but a
 * concurrent bootstrap cannot overwrite the first completed IDB import.
 */
export async function initializeLiveProjectLibrary(
  store:ProjectStore,factory:IDBFactory|null=factoryOrNull(),
):Promise<LiveInitialize>{
  const candidate=migrationCandidate(store);
  if(!candidate)return {status:"invalid-legacy"};
  if(!factory)return {status:"unavailable"};
  let db:IDBDatabase;
  try{db=await openDatabase(factory);}catch{return {status:"unavailable"};}
  try{
    return await new Promise<LiveInitialize>(resolve=>{
      let outcome:LiveInitialize={status:"unavailable"};
      try{
        const tx=db.transaction(CHECKPOINT_STORE,"readwrite");
        const request=tx.objectStore(CHECKPOINT_STORE).get(LIVE_PROJECT_RECORD_KEY);
        request.onsuccess=()=>{
          if(request.result!==undefined){
            const record=parseLiveLibraryRecord(request.result);
            outcome=record?{status:"ready",record,created:false}:{status:"invalid"};
            if(!record)tx.abort();
            return;
          }
          const record:LiveLibraryRecord={
            key:LIVE_PROJECT_RECORD_KEY,version:1,revision:1,updatedAt:Date.now(),library:candidate,
          };
          tx.objectStore(CHECKPOINT_STORE).put(record);
          outcome={status:"ready",record,created:true};
        };
        tx.oncomplete=()=>resolve(outcome);
        tx.onabort=()=>resolve(outcome.status==="ready"&&outcome.created?{status:"unavailable"}:outcome);
        tx.onerror=()=>resolve({status:"unavailable"});
      }catch{resolve({status:"unavailable"});}
    });
  }finally{db.close();}
}

/**
 * All changes to the durable snapshot pass through this revisioned transaction.
 * The mutator receives the authoritative stored snapshot, not a stale tab copy.
 * It MUST be synchronous and side-effect-free, and return null to reject a change.
 */
export async function mutateLiveProjectLibrary(
  expectedRevision:number,expectedActiveId:string,
  mutate:(current:StudioLibrary)=>StudioLibrary|null,
  factory:IDBFactory|null=factoryOrNull(),
):Promise<LiveCommit>{
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||!expectedActiveId)return {status:"invalid"};
  if(!factory)return {status:"unavailable"};
  let db:IDBDatabase;
  try{db=await openDatabase(factory);}catch{return {status:"unavailable"};}
  try{
    return await new Promise<LiveCommit>(resolve=>{
      let outcome:LiveCommit={status:"unavailable"};
      try{
        const tx=db.transaction(CHECKPOINT_STORE,"readwrite");
        const request=tx.objectStore(CHECKPOINT_STORE).get(LIVE_PROJECT_RECORD_KEY);
        request.onsuccess=()=>{
          if(request.result===undefined){
            outcome={status:"missing"};
            tx.abort();
            return;
          }
          const original=parseLiveLibraryRecord(request.result);
          if(!original){outcome={status:"invalid"};tx.abort();return;}
          if(original.revision!==expectedRevision||original.library.activeId!==expectedActiveId){
            outcome={status:"conflict"};tx.abort();return;
          }
          let next:StudioLibrary|null=null;
          try{next=mutate(original.library);}catch{next=null;}
          const library=next?validSnapshot(next):null;
          if(!library){outcome={status:"invalid"};tx.abort();return;}
          const updated:LiveLibraryRecord={
            ...original,revision:original.revision+1,updatedAt:Date.now(),library,
          };
          tx.objectStore(CHECKPOINT_STORE).put(updated);
          outcome={status:"saved",record:updated};
        };
        tx.oncomplete=()=>resolve(outcome);
        tx.onabort=()=>resolve(outcome.status==="saved"?{status:"unavailable"}:outcome);
        tx.onerror=()=>resolve({status:"unavailable"});
      }catch{resolve({status:"unavailable"});}
    });
  }finally{db.close();}
}

/** Atomic domain-specific mutations: scene/keyframes, graph, Coursework. */
export function saveLiveScene(
  revision:number,projectId:string,scene:MathDocument,now:number,
  factory:IDBFactory|null=factoryOrNull(),
):Promise<LiveCommit>{
  return mutateLiveProjectLibrary(revision,projectId,
    library=>replaceActiveScene(library,scene,now),factory);
}
export function saveLiveGraph(
  revision:number,projectId:string,graph:NodeGraph,now:number,
  factory:IDBFactory|null=factoryOrNull(),
):Promise<LiveCommit>{
  return mutateLiveProjectLibrary(revision,projectId,
    library=>replaceActiveGraph(library,graph,now),factory);
}
export function saveLiveCoursework(
  revision:number,projectId:string,draft:CourseworkDraft,now:number,
  factory:IDBFactory|null=factoryOrNull(),
):Promise<LiveCommit>{
  return mutateLiveProjectLibrary(revision,projectId,
    library=>replaceActiveCoursework(library,draft,now),factory);
}
export function currentLiveProject(record:LiveLibraryRecord){
  return activeProject(record.library);
}
