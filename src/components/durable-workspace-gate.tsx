"use client";

import {useEffect,useState} from "react";
import {durableModeEnabled,durableSessionSnapshot,DURABLE_SESSION_EVENT,hydrateDurableSession} from "@/core/projects/durable-session";

/** Do not mount sync autosave effects before IndexedDB hydration succeeds. */
export function DurableWorkspaceGate({children}:{children:React.ReactNode}){
  const [status,setStatus]=useState<"loading"|"ready"|"failed">("loading");
  const [message,setMessage]=useState("");
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
    <p>Your local project data has not been overwritten. No automatic fallback to unsafe autosave will occur.</p>
    <button type="button" onClick={()=>window.location.reload()}>Try again</button>
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
