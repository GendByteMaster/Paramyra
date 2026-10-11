"use client";

import {useEffect,useState,type ReactNode} from "react";
import {durableModeEnabled,durableSessionSnapshot,DURABLE_MODE_KEY,DURABLE_SESSION_EVENT,hydrateDurableSession} from "@/core/projects/durable-session";
import {parseStudioLibrary,PROJECT_LIBRARY_KEY} from "@/core/projects/studio-library";
import {readLiveProjectLibrary} from "@/core/projects/live-repository";

/** Do not mount sync autosave effects before IndexedDB hydration succeeds. */
export function DurableWorkspaceGate({children}:{children:ReactNode}){
  const [status,setStatus]=useState<"loading"|"ready"|"failed">("loading");
  const [message,setMessage]=useState("");
  useEffect(()=>{
    if(!durableModeEnabled())return;
    const warn=(event:BeforeUnloadEvent)=>{
      if(durableSessionSnapshot().pending>0){
        event.preventDefault();
        event.returnValue="";
      }
    };
    window.addEventListener("beforeunload",warn);
    return()=>window.removeEventListener("beforeunload",warn);
  },[]);
  useEffect(()=>{
    let mounted=true;
    if(!durableModeEnabled())return;
    void hydrateDurableSession().then(ok=>{
      if(!mounted)return;
      setStatus(ok?"ready":"failed");
      if(!ok)setMessage(durableSessionSnapshot().error??"Failed to open transactional storage");
    });
    return()=>{mounted=false;};
  },[]);
  // Legacy users can continue immediately; durable users are gated.
  if(!durableModeEnabled())return <>{children}</>;
  if(status==="loading")return <div className="shell section" role="status">Opening transactional Studio projects…</div>;
  if(status==="failed")return <div className="shell section pm-durable-gate-error" role="alert">
    <h2>Project storage needs attention</h2><p>{message}</p>
    <p>Your project data has not been overwritten. No automatic fallback to localStorage will occur.</p>
    <div className="pm-durable-recovery-actions">
      <button type="button" onClick={()=>window.location.reload()}>Try again</button>
      <button type="button" onClick={()=>{void (async()=>{
        const result=await readLiveProjectLibrary();
        if(result.status!=="ready"){window.alert("No valid IndexedDB snapshot is accessible.");return;}
        const url=URL.createObjectURL(new Blob([JSON.stringify(result.record.library,null,2)],{type:"application/json"}));
        const a=document.createElement("a");a.href=url;a.download="paramyra-idb-projects-backup.json";a.click();
        window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      })();}}>Export IndexedDB projects</button>
      <button type="button" onClick={()=>{
        try{
          const raw=localStorage.getItem(PROJECT_LIBRARY_KEY);
          if(!raw||!parseStudioLibrary(JSON.parse(raw)))throw new Error("invalid legacy backup");
          const url=URL.createObjectURL(new Blob([raw],{type:"application/json"}));
          const a=document.createElement("a");a.href=url;a.download="paramyra-compatibility-backup.json";a.click();
          window.setTimeout(()=>URL.revokeObjectURL(url),1000);
        }catch{window.alert("No valid compatibility backup found. Do not clear browser storage.");}
      }}>Export last local copy</button>
      <button type="button" onClick={()=>{
        if(!window.confirm("Stop using transactional storage and switch to the last local compatibility copy? Recent IndexedDB-only edits might not be present. The IndexedDB data itself will be preserved."))return;
        try{
          const raw=localStorage.getItem(PROJECT_LIBRARY_KEY);
          if(!raw||!parseStudioLibrary(JSON.parse(raw)))throw new Error("no valid local backup");
          localStorage.removeItem(DURABLE_MODE_KEY);
          window.location.reload();
        }catch{window.alert("No valid local project library available. Recovery mode will stay enabled.");}
      }}>Use local backup instead</button>
    </div>
  </div>;
  return <>{children}</>;
}

/** Shows conflict, pending-save and compatibility warnings in both editors. */
export function DurableStatus(){
  const [state,setState]=useState(durableSessionSnapshot);
  useEffect(()=>{
    const update=()=>setState(durableSessionSnapshot());
    window.addEventListener(DURABLE_SESSION_EVENT,update);
    return()=>window.removeEventListener(DURABLE_SESSION_EVENT,update);
  },[]);
  if(!durableModeEnabled())return null;
  if(state.error)return <aside className="pm-durable-status pm-durable-error" role="alert">
    <strong>Save conflict / unavailable storage</strong><span>{state.error} Export current JSON from this workspace before reloading.</span>
    <button type="button" onClick={()=>window.location.reload()}>Reload latest saved project</button>
  </aside>;
  return <div className="pm-durable-status" role="status" aria-live="polite">
    <span>{state.pending>0?"Saving to IndexedDB…":"Saved in IndexedDB"}</span>
    {state.mirrorWarning&&<strong>Compatibility mirror unavailable; export your project</strong>}
  </div>;
}
