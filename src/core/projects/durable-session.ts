import {activeProject,parseStudioLibrary,persistStudioLibrary,type StudioLibrary} from "./studio-library";
import {initializeLiveProjectLibrary,readLiveProjectLibrary,mutateLiveProjectLibrary,migrationCandidate,type LiveLibraryRecord} from "./live-repository";

export const DURABLE_MODE_KEY="paramyra.studio.idb-primary.v1";
export const DURABLE_SESSION_EVENT="paramyra:durable-session";
const MODE_VALUE="enabled";

type CommitState={status:"saved";record:LiveLibraryRecord}|{status:"conflict"|"missing"|"invalid"|"unavailable"};
type SessionState={record:LiveLibraryRecord|null;error:string|null;pending:number;mirrorWarning:boolean};
const session:SessionState={record:null,error:null,pending:0,mirrorWarning:false};
let queue:Promise<unknown>=Promise.resolve();

export function durableModeEnabled():boolean{
  try{return typeof localStorage!=="undefined"&&localStorage.getItem(DURABLE_MODE_KEY)===MODE_VALUE;}
  catch{return false;}
}
function publish(){
  if(typeof window!=="undefined")window.dispatchEvent(new Event(DURABLE_SESSION_EVENT));
}
export function durableSessionSnapshot():Readonly<SessionState>{
  return {...session};
}
function fail(message:string){
  session.error=message;publish();
}
function commitMirror(record:LiveLibraryRecord){
  // Existing consumers still read localStorage mirrors. In durable mode these
  // are derived caches, never the authority for IDB transaction decisions.
  if(!persistStudioLibrary(record.library,localStorage)){
    session.mirrorWarning=true;
    publish();
  }else session.mirrorWarning=false;
}
export async function settleDurableWrites():Promise<void>{
  await queue;
}
export async function hydrateDurableSession():Promise<boolean>{
  if(!durableModeEnabled())return true;
  await settleDurableWrites();
  const result=await readLiveProjectLibrary();
  if(result.status!=="ready"){
    fail("Transactional project storage cannot be opened ("+result.status+"). Legacy autosave is disabled to protect your work.");
    return false;
  }
  session.record=result.record;
  session.error=null;
  commitMirror(result.record);
  if(session.mirrorWarning){
    fail("IndexedDB loaded, but browser compatibility storage is unavailable. Export your project before proceeding.");
    return false;
  }
  publish();
  return true;
}
export function liveLibrary():StudioLibrary|null{
  return session.record?.library??null;
}
export function liveProjectId():string|null{
  return session.record?.library.activeId??null;
}
/** Sequential within a tab, CAS against the authoritative revision across tabs. */
export async function queueDurableMutation(
  update:(library:StudioLibrary)=>StudioLibrary|null,expectedProjectId:string,
):Promise<CommitState>{
  if(!durableModeEnabled())return {status:"unavailable"};
  // Count queued work immediately. "Saved" and beforeunload checks must not
  // become green while a user edit is waiting behind an earlier transaction.
  session.pending++;publish();
  const operation=async():Promise<CommitState>=>{
    try{
      if(session.error||!session.record)return {status:"unavailable"};
      const current=session.record;
      if(current.library.activeId!==expectedProjectId){
        fail("The active project changed. Export your edits, then reload to resolve the conflict.");
        return {status:"conflict"};
      }
      let result:CommitState;
      try{result=await mutateLiveProjectLibrary(current.revision,expectedProjectId,update);}
      catch{result={status:"unavailable"};}
      if(result.status!=="saved"){
        fail("Project save rejected ("+result.status+"). This tab is now read-only. Export any unsaved edits before reloading.");
        return result;
      }
      session.record=result.record;
      commitMirror(result.record);
      publish();
      return result;
    }finally{session.pending--;publish();}
  };
  const promised=queue.then(operation,operation);
  queue=promised.then(()=>undefined,()=>undefined);
  return promised;
}
/** Explicit conversion; never promote a stale preview snapshot automatically. */
export async function activateDurableStorage():Promise<"enabled"|"conflict"|"invalid"|"unavailable">{
  if(durableModeEnabled())return "enabled";
  const local=migrationCandidate(localStorage);
  if(!local)return "invalid";
  const current=await readLiveProjectLibrary();
  if(current.status==="invalid")return "invalid";
  if(current.status==="unavailable")return "unavailable";
  if(current.status==="ready"){
    // The explicit activation chooses the complete current local snapshot.
    // CAS fails if another tab changes the candidate between read and write.
    const outcome=await mutateLiveProjectLibrary(current.record.revision,current.record.library.activeId,()=>local);
    if(outcome.status!=="saved")return outcome.status==="conflict"?"conflict":"unavailable";
    session.record=outcome.record;
  }else{
    const initialized=await initializeLiveProjectLibrary(localStorage);
    if(initialized.status!=="ready")return initialized.status==="invalid"||initialized.status==="invalid-legacy"?"invalid":"unavailable";
    session.record=initialized.record;
    // On two-tab simultaneous activation, an existing snapshot could be
    // returned. No automatic overwrite is performed in that case.
    if(!initialized.created&&JSON.stringify(initialized.record.library)!==JSON.stringify(local))return "conflict";
  }
  try{
    localStorage.setItem(DURABLE_MODE_KEY,MODE_VALUE);
    if(localStorage.getItem(DURABLE_MODE_KEY)!==MODE_VALUE)return "unavailable";
  }catch{return "unavailable";}
  publish();
  return "enabled";
}
export function durableProjectSnapshot():StudioLibrary|null{
  const raw=session.record?.library;
  return raw?parseStudioLibrary(raw):null;
}
export function currentDurableProject(){
  return session.record?activeProject(session.record.library):null;
}
